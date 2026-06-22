'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Stream {
  title?: string;
  link: string;
  api?: string;
}

interface EventInfo {
  eventCat: string;
  eventName: string;
  teamA: string;
  teamB: string;
  teamAFlag: string;
  teamBFlag: string;
  startTime: string;
  endTime: string;
  link_names?: string[];
}

interface Match {
  id: number | string;
  eventInfo: EventInfo;
  links?: string;
}

interface ServerFailureRecord {
  time: number;
  attempts: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIVE_EVENTS_API =
  process.env.NEXT_PUBLIC_LIVE_EVENTS_API ||
  'https://ratulxadia-playz-cats-event.hf.space/api/events';

const STREAM_API_BASE =
  process.env.NEXT_PUBLIC_STREAM_API_BASE ||
  'https://ratulxadia-playz-cats-event.hf.space/api/stream/';

const IMG_PROXY =
  process.env.NEXT_PUBLIC_IMG_PROXY || 'https://img.aiorbd.workers.dev/?url=';

const CONFIG = {
  maxRetry: 2,
  baseRetryDelay: 1000,
  failoverCooldown: 1000, 
  stallDetectionDelay: 20000,
  stallCheckInterval: 5000,
  serverBlacklistDuration: 20000,
  controlsHideDelay: 3000,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined | null) => {
  if (!url || url === 'null') return '/fallback-logo.png';
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMimeType = (url: string): string | undefined => {
  if (url.includes('.mpd')) return 'application/dash+xml';
  if (url.includes('.m3u8')) return 'application/x-mpegURL';
  return undefined;
};

const convertDate = (dStr: string, tStr: string): string => {
  if (!dStr || !tStr) return '';
  try {
    let day = 1, month = 1, year = 2026;
    if (dStr.includes('/')) {
      const parts = dStr.split('/');
      [day, month, year] = [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
    } else if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts[0].length === 4) {
        [year, month, day] = [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
      } else {
        [day, month, year] = [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
      }
    }
    const timeParts = tStr.split(':');
    let hours = (parseInt(timeParts[0], 10) || 0) + 12;
    const minutes = parseInt(timeParts[1], 10) || 0;
    const seconds = parseInt(timeParts[2], 10) || 0;
    const utcTimestamp = Date.UTC(year, month - 1, day, hours - 6, minutes, seconds);
    return new Date(utcTimestamp).toISOString();
  } catch { return ''; }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);

  const streamsRef = useRef<Stream[] | null>(null);
  const currentlyPlayingUrlRef = useRef<string | null>(null);
  const lastAppliedDrmRef = useRef<string | null>(null);
  const lastFailoverTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const timersRef = useRef<Set<any>>(new Set());
  const lastProgressRef = useRef(Date.now());

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [failedServers, setFailedServers] = useState<Record<string, ServerFailureRecord>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: rawMatches } = useSWR(LIVE_EVENTS_API ? LIVE_EVENTS_API : null, fetcher, {
    revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false,
  });

  const matches = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;
    return rawMatches.map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const startTime = convertDate(rawEvent.date, rawEvent.time);
      const endTime = convertDate(rawEvent.end_date || rawEvent.date, rawEvent.end_time || rawEvent.time);
      const matchId = rawEvent.links ? rawEvent.links.replace('pro/', '').replace('.txt', '') : index.toString();
      return {
        id: matchId, links: rawEvent.links || '',
        eventInfo: {
          eventCat: rawEvent.category || 'Live Event', eventName: rawEvent.eventName || 'Live Match',
          teamA: rawEvent.teamAName || 'Team A', teamB: rawEvent.teamBName || 'Team B',
          teamAFlag: rawEvent.teamAFlag || '', teamBFlag: rawEvent.teamBFlag || '',
          startTime, endTime, eventLogo: rawEvent.eventLogo || '', link_names: rawEvent.link_names || [],
        },
      };
    });
  }, [rawMatches]);

  const matchMap = useMemo(() => new Map((matches ?? []).map((m: any) => [String(m.id), m])), [matches]);

  const currentMatch = useMemo(() => {
    let match = matchMap.get(id);
    if (!match) match = matchMap.get(id.split('-').pop() || id);
    return match || null;
  }, [matchMap, id]);

  const streamFetchUrl = useMemo(() => {
    if (currentMatch?.links && STREAM_API_BASE) {
      const streamSlug = currentMatch.links.replace('pro/', '').replace('.txt', '');
      const base = STREAM_API_BASE.endsWith('/') ? STREAM_API_BASE : `${STREAM_API_BASE}/`;
      return STREAM_API_BASE.includes('firebaseio.com') ? `${base}${streamSlug}.json` : `${base}${streamSlug}`;
    }
    return null;
  }, [currentMatch]);

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, {
    revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false,
  });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;
    const rawList = Array.isArray(streamsFromApi) ? streamsFromApi : streamsFromApi.streams || [];
    if (rawList.length === 0) return null;
    return rawList.filter((s: any) => s && (s.link || s.url)).map((s: any) => ({
      link: s.link || s.url || '', title: s.title, api: s.api,
    }));
  }, [streamsFromApi]);

  const currentStreamUrl = useMemo(() => streams?.[activeStreamIndex]?.link || null, [streams, activeStreamIndex]);

  useEffect(() => { streamsRef.current = streams; }, [streams]);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 5000); return () => clearInterval(timer); }, []);

  useEffect(() => {
    setActiveStreamIndex(0); setAllServersDown(false); setFailedServers({});
    currentlyPlayingUrlRef.current = null; lastAppliedDrmRef.current = null;
    lastFailoverTimeRef.current = 0; retryCountRef.current = 0;
  }, [id]);

  const markServerFailed = useCallback((index: number) => {
    setFailedServers((prev) => {
      const current = prev[index] || { time: 0, attempts: 0 };
      return { ...prev, [index]: { time: Date.now(), attempts: current.attempts + 1 } };
    });
  }, []);

  const removeServerFailure = useCallback((index: number) => {
    setFailedServers((prev) => { const { [index]: _, ...rest } = prev; return rest; });
  }, []);

  const safeSwitchServer = useCallback(() => {
    const now = Date.now();
    if (now - lastFailoverTimeRef.current < CONFIG.failoverCooldown) return;
    lastFailoverTimeRef.current = now;
    retryCountRef.current = 0;

    setActiveStreamIndex((prevIndex) => {
      const list = streamsRef.current;
      if (!list) return prevIndex;
      markServerFailed(prevIndex);

      for (let i = 1; i <= list.length; i++) {
        const checkIndex = (prevIndex + i) % list.length;
        const failureRecord = failedServers[checkIndex];
        if (!failureRecord) return checkIndex;

        const cooldown = CONFIG.serverBlacklistDuration * Math.pow(2, failureRecord.attempts - 1);
        if (now - failureRecord.time > cooldown) return checkIndex;
      }
      setAllServersDown(true); setIsBuffering(false); return prevIndex;
    });
  }, [markServerFailed, failedServers]);

  const handleManualSwitch = (idx: number) => {
    removeServerFailure(idx);
    setAllServersDown(false);
    setActiveStreamIndex(idx);
    currentlyPlayingUrlRef.current = null;
  };
  // ========================================================================
  // Unified Engine: প্লেয়ার তৈরি এবং ভিডিও লোড একসাথে সিঙ্ক করা হলো (হ্যাং ফিক্স)
  // ========================================================================
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || allServersDown || !currentStreamUrl || !streams?.length) {
      return;
    }

    let shaka: any;
    let player: any;
    let ui: any;
    let isMounted = true;

    const startStreaming = async () => {
      setIsBuffering(true);
      try {
        // ১. প্রতিবার সার্ভার চেঞ্জের সময় পুরনো প্লেয়ার ক্লিনআপ করা হবে
        if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
        if (playerRef.current) { await playerRef.current.destroy(); playerRef.current = null; }

        shaka = await import('shaka-player/dist/shaka-player.ui');
        if (!isMounted) return;
        shaka.polyfill.installAll();

        // ২. ফ্রেশ প্লেয়ার অবজেক্ট তৈরি
        player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen'],
          addSeekBar: true,
          trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat.LABEL,
        });

        player.configure({
          streaming: {
            bufferingGoal: 10, rebufferingGoal: 1, bufferBehind: 15,
            startAtSegmentBoundary: true, jumpLargeGaps: true,
            retryParameters: { maxAttempts: 5, baseDelay: 400, timeout: 8000 }
          }
        });

        // ৩. ইভেন্ট লিসেনার সিঙ্ক
        player.addEventListener('buffering', (e: any) => { if (isMounted) setIsBuffering(e.buffering); });
        player.addEventListener('error', () => { if (isMounted) safeSwitchServer(); });

        // ৪. রিয়াল-টাইম DRM ইনজেকশন
        const currentStream = streams[activeStreamIndex];
        const newDrmApi = currentStream?.api || '';
        const clearKeysObj: Record<string, string> = {};
        let parsedData: any = newDrmApi;

        if (typeof newDrmApi === 'string' && newDrmApi.trim().startsWith('{')) {
          try { parsedData = JSON.parse(newDrmApi.trim()); } catch (e) {}
        }

        if (typeof parsedData === 'object' && parsedData !== null) {
          Object.entries(parsedData).forEach(([k, v]) => {
            const cleanKid = k.replace(/['"\s{}:]/g, '');
            const cleanKey = String(v).replace(/['"\s{}:]/g, '');
            if (cleanKid && cleanKey) clearKeysObj[cleanKid] = cleanKey;
          });
        } else if (typeof parsedData === 'string' && parsedData.includes(':')) {
          const parts = parsedData.replace(/['"\s{}]/g, '').split(':');
          if (parts.length === 2) clearKeysObj[parts[0]] = parts[1];
        }

        if (Object.keys(clearKeysObj).length > 0) {
          player.configure({ drm: { clearKeys: clearKeysObj } });
        }

        // ৫. স্ট্রিম লোড ও ফোর্স প্লে
        const mimeType = getMimeType(currentStreamUrl);
        await player.load(currentStreamUrl, null, mimeType);
        
        if (videoRef.current && isMounted) {
          videoRef.current.play().catch(() => {});
        }
        if (isMounted) setIsBuffering(false);

      } catch (err) {
        console.error('[Engine Error]', err);
        if (isMounted) safeSwitchServer();
      }
    };

    startStreaming();

    return () => {
      isMounted = false;
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams, safeSwitchServer]);

  // কম্পোনেন্ট পুরোপুরি আনমাউন্ট হলে হার্ড ক্লিনআপ
  useEffect(() => {
    return () => {
      if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const matchTitle = currentMatch?.eventInfo && `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}`;

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 outline-none transition-colors active:scale-[0.95]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-bold hidden sm:inline">Back to Home</span>
            </button>
          </Link>
          <span className="text-sm md:text-base font-bold text-gray-100 truncate max-w-xs sm:max-w-md tracking-wide">
            {matchTitle || 'Live Streaming'}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 mt-4">
        <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-xl border border-gray-800 shaka-video-container group">
          
          {!streams && !allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/90 z-10 flex-col gap-3">
              <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#00E5FF] font-bold text-sm animate-pulse tracking-wider">Fetching Secure Stream...</span>
            </div>
          )}

          {isBuffering && !allServersDown && streams && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
              <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/95 z-50 flex-col gap-4 text-center p-4">
              <span className="text-4xl">📡</span>
              <div className="text-red-400 font-bold tracking-wide">Stream Currently Unavailable</div>
              <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); setFailedServers({}); }} className="mt-2 bg-[#1C1E2B] border border-gray-700 hover:border-[#00E5FF] text-white px-5 py-2 rounded-full text-xs font-bold">Retry Connections</button>
            </div>
          )}

          <video ref={videoRef} autoPlay playsInline muted={false} className="w-full h-full" style={{ objectFit }} />
        </div>

        {streams && streams.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-4 my-2 border-b border-gray-800/40 items-center">
            <span className="text-gray-400 font-bold text-xs md:text-sm mr-2 whitespace-nowrap uppercase tracking-wider">Servers:</span>
            {streams.map((stream, index) => {
              const failureRecord = failedServers[index];
              const isFailed = failureRecord && currentTime.getTime() - failureRecord.time < CONFIG.serverBlacklistDuration * Math.pow(2, failureRecord.attempts - 1);
              const serverName = stream.title || currentMatch?.eventInfo.link_names?.[index] || `Server ${index + 1}`;

              return (
                <button
                  key={index}
                  disabled={isFailed}
                  onClick={() => handleManualSwitch(index)}
                  className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border outline-none duration-150 ${
                    activeStreamIndex === index && !allServersDown
                      ? 'bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                      : isFailed
                        ? 'bg-red-900/20 border-red-900/50 text-red-500/50 cursor-not-allowed'
                        : 'bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white'
                  }`}
                >
                  {serverName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `.scrollbar-hide::-webkit-scrollbar { display: none; } .shaka-scrim-container { display: none !important; }`,
      }} />
    </main>
  );
}
