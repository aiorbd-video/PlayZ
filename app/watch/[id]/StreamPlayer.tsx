'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

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

const LIVE_EVENTS_API = process.env.NEXT_PUBLIC_LIVE_EVENTS_API || "https://ratulxadia-playz-cats-event.hf.space/api/events";
const STREAM_API_BASE = process.env.NEXT_PUBLIC_STREAM_API_BASE || "https://ratulxadia-playz-cats-event.hf.space/api/stream/";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined | null) => {
  if (!url || url === "null") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMimeType = (url: string) => {
  if (url.includes('.mpd')) return 'application/dash+xml';
  if (url.includes('.m3u8')) return 'application/x-mpegURL';
  return undefined;
};

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerInitRef = useRef(false);

  const streamsRef = useRef<Stream[] | null>(null);
  const currentlyPlayingUrlRef = useRef<string | null>(null);
  const activeIndexRef = useRef<number>(0);
  const retryCountRef = useRef(0);
  const maxRetry = 2;
  const baseRetryDelay = 1000; 
  
  // 🎯 Fix 5: Exponential Cooldown Blacklist (stores time & attempts)
  const failedServersRef = useRef<Map<number, { time: number, attempts: number }>>(new Map());
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  
  const failoverLockRef = useRef(false);
  const failoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorLockRef = useRef(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const bufferingHandlerRef = useRef<any>(null);
  const errorHandlerRef = useRef<any>(null);
  const lastProgressRef = useRef<number>(Date.now());
  const isBufferingRef = useRef<boolean>(true); 

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: rawMatches } = useSWR(LIVE_EVENTS_API ? LIVE_EVENTS_API : null, fetcher, { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false });

  const matches = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;
    return rawMatches.map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const convertDate = (dStr: string, tStr: string) => {
        if (!dStr || !tStr) return "";
        try {
          const parts = dStr.split('/');
          let day = 1, month = 1, year = 2026;
          if (parts.length === 3) {
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
          } else if (dStr.includes('-')) {
            const hyphenParts = dStr.split('-');
            if (hyphenParts[0].length === 4) {
              year = parseInt(hyphenParts[0], 10); month = parseInt(hyphenParts[1], 10); day = parseInt(hyphenParts[2], 10);
            } else {
              day = parseInt(hyphenParts[0], 10); month = parseInt(hyphenParts[1], 10); year = parseInt(hyphenParts[2], 10);
            }
          }
          const timeParts = tStr.split(':');
          const hours = parseInt(timeParts[0], 10) || 0;
          const minutes = parseInt(timeParts[1], 10) || 0;
          const localTimestamp = new Date(year, month - 1, day, hours, minutes, 0).getTime();
          const utcTimestamp = localTimestamp - (6 * 60 * 60 * 1000); 
          return new Date(utcTimestamp).toISOString();
        } catch (e) { return ""; }
      };
      
      const startTime = convertDate(rawEvent.date, rawEvent.time);
      const endTime = convertDate(rawEvent.end_date || rawEvent.date, rawEvent.end_time || rawEvent.time);
      const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : index.toString();
      
      return {
        id: matchId,
        links: rawEvent.links || "",
        eventInfo: {
          eventCat: rawEvent.category || "Live Event", eventName: rawEvent.eventName || "Live Match",
          teamA: rawEvent.teamAName || "Team A", teamB: rawEvent.teamBName || "Team B",
          teamAFlag: rawEvent.teamAFlag || "", teamBFlag: rawEvent.teamBFlag || "",
          startTime, endTime, eventLogo: rawEvent.eventLogo || "", link_names: rawEvent.link_names || []
        }
      };
    });
  }, [rawMatches]);

  const matchMap = useMemo(() => new Map((matches ?? []).map((m: any) => [String(m.id), m])), [matches]);

  const currentMatch = useMemo(() => {
    if (!matchMap) return null;
    let match = matchMap.get(id);
    if (!match) match = matchMap.get(id.split('-').pop() || id);
    return match || null;
  }, [matchMap, id]);

  const streamFetchUrl = useMemo(() => {
    if (currentMatch && currentMatch.links && STREAM_API_BASE) {
      const streamSlug = currentMatch.links.replace("pro/", "").replace(".txt", "");
      const base = STREAM_API_BASE.endsWith('/') ? STREAM_API_BASE : `${STREAM_API_BASE}/`;
      return STREAM_API_BASE.includes("firebaseio.com") ? `${base}${streamSlug}.json` : `${base}${streamSlug}`;
    }
    return null;
  }, [currentMatch]);

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;
    let rawList: any[] | null = null;
    if (Array.isArray(streamsFromApi)) rawList = streamsFromApi;
    else if (streamsFromApi.streams && Array.isArray(streamsFromApi.streams)) rawList = streamsFromApi.streams;
    if (!rawList) return null;
    
    return rawList.filter(s => s && (typeof s.link === 'string' || typeof s.url === 'string')).map(s => ({
      ...s,
      link: s.link || s.url || "",
      title: typeof s.title === 'string' ? s.title : undefined,
      api: typeof s.api === 'string' ? s.api : undefined
    }));
  }, [streamsFromApi]);

  const currentStreamUrl = useMemo(() => {
    if (!streams?.length) return null;
    return streams[activeStreamIndex]?.link || null;
  }, [streams, activeStreamIndex]);

  useEffect(() => { streamsRef.current = streams; }, [streams]);
  useEffect(() => { activeIndexRef.current = activeStreamIndex; }, [activeStreamIndex]);

  useEffect(() => {
    setActiveStreamIndex(0);
    setAllServersDown(false);
    currentlyPlayingUrlRef.current = null;
    failedServersRef.current.clear();
    retryCountRef.current = 0;
  }, [id]);

  useEffect(() => {
    const blockInspect = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => { if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J'))) e.preventDefault(); };
    document.addEventListener('contextmenu', blockInspect); document.addEventListener('keydown', blockKeys);
    return () => { document.removeEventListener('contextmenu', blockInspect); document.removeEventListener('keydown', blockKeys); };
  }, []);

  const handleFitToggle = useCallback(() => {
    const fitModes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
    setObjectFit(prev => {
      const next = fitModes[(fitModes.indexOf(prev) + 1) % fitModes.length];
      setShowFitToast(true); return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('toggleObjectFit', handleFitToggle);
    return () => window.removeEventListener('toggleObjectFit', handleFitToggle);
  }, [handleFitToggle]);

  useEffect(() => {
    if (showFitToast) {
      const t = setTimeout(() => setShowFitToast(false), 2000);
      timersRef.current.add(t);
      return () => { clearTimeout(t); timersRef.current.delete(t); };
    }
  }, [showFitToast, objectFit]);

  useEffect(() => { if (videoRef.current) videoRef.current.style.objectFit = objectFit; }, [objectFit]);

  // 🎯 Fix 5: Exponential Backoff Failover Logic
  const safeSwitchServer = useCallback(() => {
    if (failoverLockRef.current) return;
    failoverLockRef.current = true;
    retryCountRef.current = 0;

    setActiveStreamIndex((prevIndex) => {
      const list = streamsRef.current;
      if (!list) return prevIndex;
      
      const currentFail = failedServersRef.current.get(prevIndex) || { time: 0, attempts: 0 };
      failedServersRef.current.set(prevIndex, { time: Date.now(), attempts: currentFail.attempts + 1 });
      
      let nextValidIndex = -1;
      const now = Date.now();
      
      for (let i = 0; i < list.length; i++) {
        const fd = failedServersRef.current.get(i);
        if (!fd) {
          nextValidIndex = i; break;
        } else {
          // Exponential Cooldown: 60s, 120s, 240s based on attempts
          const cooldown = 60000 * Math.pow(2, fd.attempts - 1);
          if (now - fd.time > cooldown) {
            nextValidIndex = i; break;
          }
        }
      }

      if (nextValidIndex !== -1) {
        console.log(`[Failover] Switching to Server ${nextValidIndex + 1}`);
        return nextValidIndex;
      } else {
        console.log("[Failover] All servers blacklisted. Stream Unavailable.");
        setAllServersDown(true);
        setIsBuffering(false);
        isBufferingRef.current = false;
        return prevIndex;
      }
    });

    if (failoverTimeoutRef.current) clearTimeout(failoverTimeoutRef.current);
    failoverTimeoutRef.current = setTimeout(() => { failoverLockRef.current = false; }, 3000);
  }, []);

  const getFreshUrl = useCallback((url: string) => { return url + (url.includes('?') ? '&' : '?') + '__t=' + Date.now(); }, []);

  const forceReloadStream = useCallback(() => {
    if (playerRef.current && currentlyPlayingUrlRef.current) {
      const mimeType = getMimeType(currentlyPlayingUrlRef.current);
      playerRef.current.unload().then(() => {
        playerRef.current.load(currentlyPlayingUrlRef.current!, null, mimeType).catch(() => {});
      }).catch(() => {});
    }
  }, []);

  const handleStreamError = useCallback(async (error: any) => {
    if (errorLockRef.current) return;
    errorLockRef.current = true;
    
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => { errorLockRef.current = false; }, 2000);

    const code = error?.detail?.code || error?.code;
    const severity = error?.detail?.severity || error?.severity;
    console.log("Stream Error:", code);

    if (code === 7000 || code === 7002) return;

    if (code === 1001 || code === 1002 || code === 6002 || code === 3016 || code === 3015 || severity === 2) {
      if (retryCountRef.current < maxRetry) {
        retryCountRef.current++;
        const backoffDelay = baseRetryDelay * retryCountRef.current;
        console.log(`Retrying in ${backoffDelay}ms...`);
        const t = setTimeout(() => { forceReloadStream(); }, backoffDelay);
        timersRef.current.add(t);
        return;
      }
      safeSwitchServer();
    }
  }, [forceReloadStream, safeSwitchServer]);

  errorHandlerRef.current = handleStreamError;
  bufferingHandlerRef.current = (e: any) => {
    setIsBuffering(e.buffering);
    isBufferingRef.current = e.buffering;
  };
  // ==========================================
  // PLAYER INITIALIZATION & UI EVENTS
  // ==========================================
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;
    if (playerInitRef.current) return;
    
    let shaka: any; let player: any; let ui: any;
    let isCancelled = false;
    
    const initPlayer = async () => {
      try {
        shaka = await import('shaka-player/dist/shaka-player.ui');
        if (isCancelled) return;
        shaka.polyfill.installAll();
        
        try {
          if (shaka.ui.Controls && !(shaka.ui.Controls as any).custom_stretch_registered) {
            class StretchButton extends shaka.ui.Element {
              constructor(parent: HTMLElement, controls: any) {
                super(parent, controls);
                const button = document.createElement('button');
                button.className = 'shaka-custom-stretch-btn shaka-tooltip';
                button.setAttribute('aria-label', 'Toggle Fit');
                button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
                this.eventManager.listen(button, 'click', () => window.dispatchEvent(new CustomEvent('toggleObjectFit')));
                parent.appendChild(button);
              }
            }
            shaka.ui.Controls.registerElement('custom_stretch', { create: (root: HTMLElement, ctrls: any) => new StretchButton(root, ctrls) });
            (shaka.ui.Controls as any).custom_stretch_registered = true;
          }
        } catch (e) {}

        player = new shaka.Player(videoRef.current);
        playerRef.current = player;
        
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'overflow_menu', 'fullscreen'],
          addSeekBar: true,
          trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat.LABEL
        });
        
        const handleFullscreen = () => {
          if (document.fullscreenElement && window.screen?.orientation && (window.screen.orientation as any).lock) {
            (window.screen.orientation as any).lock('landscape').catch(() => {});
          }
        };
        document.addEventListener('fullscreenchange', handleFullscreen);
        (ui as any).cleanupFullscreen = () => document.removeEventListener('fullscreenchange', handleFullscreen);
        
        const handleTimeUpdate = () => { lastProgressRef.current = Date.now(); };
        videoRef.current?.addEventListener('timeupdate', handleTimeUpdate);
        (ui as any).cleanupTimeUpdate = () => videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);

        // 🎯 Fix 4: Live Sports Friendly Stall Detection (15s instead of 10s)
        const checkStall = setInterval(() => {
          if (isBufferingRef.current && (Date.now() - lastProgressRef.current > 15000)) {
            console.log("Stall detected via timestamp → Switching server");
            safeSwitchServer();
          }
        }, 5000);
        timersRef.current.add(checkStall);
        
        const onBuffering = (e: any) => { if (bufferingHandlerRef.current) bufferingHandlerRef.current(e); };
        const onError = (e: any) => { if (errorHandlerRef.current) errorHandlerRef.current(e); };
        
        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);
        
        (ui as any).cleanupShakaEvents = () => {
          player.removeEventListener('buffering', onBuffering);
          player.removeEventListener('error', onError);
        };
        
        playerInitRef.current = true;
        
      } catch (err) {
        console.error("Init Error", err);
        playerInitRef.current = false;
      }
    };
    
    initPlayer();
    
    return () => {
      isCancelled = true;
      if (playerRef.current) playerInitRef.current = false;
      
      if (ui) {
        if ((ui as any).cleanupFullscreen) (ui as any).cleanupFullscreen();
        if ((ui as any).cleanupTimeUpdate) (ui as any).cleanupTimeUpdate();
        if ((ui as any).cleanupShakaEvents) (ui as any).cleanupShakaEvents();
        ui.destroy();
      }
      
      if (playerRef.current) {
        try { playerRef.current.unload(); } catch {}
        playerRef.current.destroy();
        playerRef.current = null;
      }
      
      timersRef.current.forEach(clearTimeout);
      timersRef.current.forEach(clearInterval);
      timersRef.current.clear();
    };
  }, [safeSwitchServer]);

  useEffect(() => {
    if (!playerRef.current || !streams || streams.length === 0 || allServersDown || !currentStreamUrl) return;
    if (currentlyPlayingUrlRef.current === currentStreamUrl || failedServersRef.current.has(activeStreamIndex)) return;

    let isMounted = true;
    const loadVideo = async () => {
      setIsBuffering(true);
      isBufferingRef.current = true;
      
      try {
        await playerRef.current.unload();
        
        playerRef.current.configure({
          streaming: {
            bufferingGoal: 15, rebufferingGoal: 1, bufferBehind: 20, bufferLead: 10,
            startAtSegmentBoundary: true, jumpLargeGaps: true, smallGapLimit: 2,
            ignoreTextStreamFailures: true, inaccurateManifestTolerance: 2, lowLatencyMode: false,
            stallEnabled: true, stallThreshold: 1, stallSkip: 0.5,
            retryParameters: { maxAttempts: 15, baseDelay: 500, timeout: 15000 }
          },
          manifest: {
            retryParameters: { maxAttempts: 15, baseDelay: 500, timeout: 15000 },
            dash: { ignoreMinBufferTime: true, autoCorrectDrift: true },
            hls: { ignoreManifestProgramDateTime: true, sequenceMode: true }
          },
          abr: {
            enabled: true, switchInterval: 2, bandwidthDowngradeTarget: 0.95, 
            bandwidthUpgradeTarget: 0.75, restrictToElementSize: true, 
            clearBufferSwitch: false, safeMarginSwitch: true
          }
        });
        
        // 🎯 ClearKey Setup Maintained Before Load
        const currentStreamObj = streams[activeStreamIndex];
        if (currentStreamObj && currentStreamObj.api) {
          const cleanDrm = currentStreamObj.api.replace(/['"\s]/g, '');
          const parts = cleanDrm.split(':');
          if (parts.length >= 2) {
            const kid = parts[0];
            const key = parts.slice(1).join(':');
            playerRef.current.configure({ drm: { clearKeys: { [kid]: key } } });
          }
        }
        
        const mimeType = getMimeType(currentStreamUrl);
        
        try {
          await playerRef.current.load(currentStreamUrl, null, mimeType);
          currentlyPlayingUrlRef.current = currentStreamUrl; 
        } catch (err: any) {
          console.log("Load failed:", err?.code);
          if (retryCountRef.current < maxRetry) {
            retryCountRef.current++;
            const backoffDelay = baseRetryDelay * retryCountRef.current;
            const t = setTimeout(() => forceReloadStream(), backoffDelay);
            timersRef.current.add(t);
            return;
          }
          if (isMounted) safeSwitchServer();
        }

      } catch (error: any) {
        if (error.code !== 7000 && error.code !== 7002) {
          if (isMounted) safeSwitchServer();
        }
      } finally {
        if (isMounted) {
          setIsBuffering(false);
          isBufferingRef.current = false;
        }
      }
    };
    loadVideo();
    return () => { isMounted = false; };
  }, [currentStreamUrl, streams, activeStreamIndex, allServersDown, safeSwitchServer, forceReloadStream]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden && isBufferingRef.current) forceReloadStream(); };
    const handleOnline = () => { forceReloadStream(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [forceReloadStream]);

  const handleUserActivity = () => {
    setIsControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setIsControlsVisible(false), 3000);
  };

  const handleShare = async () => {
    const matchTitle = currentMatch && currentMatch.eventInfo ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}` : 'Live Match';
    const shareUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: matchTitle, url: shareUrl }); } catch (error) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      const t = setTimeout(() => setShowCopied(false), 2000);
      timersRef.current.add(t);
    }
  };

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
            {currentMatch && currentMatch.eventInfo ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}` : "Live Streaming"}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 mt-4 flex flex-col">
        <div className="w-full flex flex-col">
          <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-xl border border-gray-800 shaka-video-container group" onMouseMoveCapture={handleUserActivity} onTouchStartCapture={handleUserActivity} onClickCapture={handleUserActivity} onMouseLeave={() => setIsControlsVisible(false)}>
            
            {!streams && !allServersDown && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/90 z-10 flex-col gap-3">
                <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[#00E5FF] font-bold text-sm animate-pulse tracking-wider">Fetching Secure Stream...</span>
              </div>
            )}

            {isBuffering && !allServersDown && streams && (
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 border border-[#00E5FF]/30 px-5 py-2.5 rounded-full flex items-center gap-2 pointer-events-none shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                <div className="w-4 h-4 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white font-bold text-xs tracking-wide whitespace-nowrap">Connecting to Server {activeStreamIndex + 1}...</p>
              </div>
            )}

            {allServersDown && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/95 z-50 flex-col gap-4 text-center p-4">
                <span className="text-4xl">📡</span>
                <div className="text-red-400 font-bold tracking-wide">Stream Currently Unavailable</div>
                <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); currentlyPlayingUrlRef.current = null; failedServersRef.current.clear(); }} className="mt-2 bg-[#1C1E2B] border border-gray-700 hover:border-[#00E5FF] text-white px-5 py-2 rounded-full text-xs font-bold">Retry Server 1</button>
              </div>
            )}

            <video ref={videoRef} autoPlay playsInline preload="auto" muted={false} className="w-full h-full transition-all duration-300 pointer-events-none" />

            <AnimatePresence>
              {showFitToast && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-6 left-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700/50 shadow-xl z-50 flex items-center gap-2 pointer-events-none" >
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></span>
                  <span className="text-xs md:text-sm font-bold text-white capitalize">{objectFit === 'contain' ? 'Fit to Screen' : objectFit === 'cover' ? 'Zoom (Cropped)' : 'Stretch (Fill)'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {streams && streams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-4 my-2 border-b border-gray-800/40 items-center">
              <span className="text-gray-400 font-bold text-xs md:text-sm mr-2 whitespace-nowrap uppercase tracking-wider">Servers:</span>
              {streams.map((stream, index) => {
                const fd = failedServersRef.current.get(index);
                const isFailed = !!fd && (Date.now() - fd.time < 60000 * Math.pow(2, fd.attempts - 1));
                const serverName = stream.title || (currentMatch?.eventInfo as any)?.link_names?.[index] || `Server ${index + 1}`;
                return (
                  <button key={index} disabled={isFailed} onClick={() => { failedServersRef.current.delete(index); setAllServersDown(false); setActiveStreamIndex(index); currentlyPlayingUrlRef.current = null; }} className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border outline-none duration-150 ${activeStreamIndex === index && !allServersDown ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]" : isFailed ? "bg-red-900/20 border-red-900/50 text-red-500/50 cursor-not-allowed" : "bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white"}`} >
                    {serverName}
                  </button>
                );
              })}
            </div>
          )}

          {currentMatch && currentMatch.eventInfo ? (
            <div className="bg-[#1C1E2B] border border border-[#00E5FF]/40 rounded-[20px] p-5 mt-3 shadow-lg relative group">
              <button onClick={handleShare} className="absolute top-4 right-4 bg-gray-800/50 hover:bg-[#00E5FF]/20 text-gray-400 hover:text-[#00E5FF] p-2 rounded-full border border-gray-700/50 transition-all z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              {showCopied && <div className="absolute -top-8 right-2 bg-[#00E5FF] text-black text-[10px] font-bold px-3 py-1 rounded shadow-lg">Link Copied!</div>}
              <div className="text-center text-xs font-bold text-[#00E5FF] uppercase tracking-widest mb-4 pr-8">{currentMatch.eventInfo.eventCat} | {currentMatch.eventInfo.eventName}</div>
              <div className="flex justify-center items-center gap-6 sm:gap-12 py-2">
                <div className="flex items-center gap-3 w-[40%] justify-end">
                  <span className="font-bold text-sm md:text-base text-gray-200 text-right truncate">{currentMatch.eventInfo.teamA}</span>
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700/50 flex-shrink-0 relative"><Image unoptimized src={getImg(currentMatch.eventInfo.teamAFlag)} fill className="object-cover" alt="" /></div>
                </div>
                <span className="text-gray-400 font-black italic text-sm md:text-base px-2">VS</span>
                <div className="flex items-center gap-3 w-[40%] justify-start">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700/50 flex-shrink-0 relative"><Image unoptimized src={getImg(currentMatch.eventInfo.teamBFlag)} fill className="object-cover" alt="" /></div>
                  <span className="font-bold text-sm md:text-base text-gray-200 text-left truncate">{currentMatch.eventInfo.teamB}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .shaka-custom-stretch-btn { background: transparent; border: none; color: white; cursor: pointer; padding: 5px; opacity: 0.8; display: flex; align-items: center; justify-content: center; } 
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .shaka-scrim-container { display: none !important; background: transparent !important; }
      `}} />
      <Script src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js" strategy="lazyOnload" id="adsterra-popunder" />
    </main>
  );
        }
