'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';

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
// CONSTANTS & HELPERS
// ============================================================================

const LIVE_EVENTS_API = 'https://ratulxadia-playz-cats-event.hf.space/api/events';
const STREAM_API_BASE = 'https://ratulxadia-playz-cats-event.hf.space/api/stream/';

const CONFIG = {
  failoverCooldown: 1000,
  serverBlacklistDuration: 20000,
} as const;

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

// ============================================================================
// LOG OVERLAY COMPONENT
// ============================================================================

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

import { forwardRef, useImperativeHandle } from 'react';

const PlayerLogs = forwardRef<PlayerLogsHandle>((_, ref) => {
  const [logs, setLogs] = useState<{ id: string; msg: string; type: string; time: string }[]>([]);

  useImperativeHandle(ref, () => ({
    addLog: (message: string, type = 'info') => {
      const timeStr = new Date().toLocaleTimeString();
      setLogs((prev) => [
        { id: Math.random().toString(), msg: message, type, time: timeStr },
        ...prev.slice(0, 49),
      ]);
    },
    clearLogs: () => setLogs([]),
  }));

  if (logs.length === 0) {
    return (
      <div className="mt-4 p-4 bg-[#1C1E2B] rounded-xl border border-gray-800 text-center text-xs text-gray-500">
        No active logs yet. Waiting for player actions...
      </div>
    );
  }

  return (
    <div className="mt-4 bg-[#1C1E2B] rounded-xl border border-gray-800 overflow-hidden shadow-inner">
      <div className="p-3 bg-gray-950/40 border-b border-gray-800 flex justify-between items-center">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Shaka Engine Live Logs
        </span>
        <button onClick={() => setLogs([])} className="text-[11px] text-gray-500 hover:text-white bg-gray-900 px-2 py-1 rounded border border-gray-800">
          Clear Logs
        </button>
      </div>
      <div className="p-3 max-h-[220px] overflow-y-auto font-mono text-[11px] space-y-1.5 scrollbar-hide">
        {logs.map((log) => {
          let typeColor = 'text-gray-300';
          if (log.type === 'success') typeColor = 'text-green-400 font-semibold';
          if (log.type === 'error') typeColor = 'text-red-400 font-bold';
          if (log.type === 'warn') typeColor = 'text-yellow-400';
          return (
            <div key={log.id} className="flex gap-2 items-start border-b border-gray-800/30 pb-1">
              <span className="text-gray-600 shrink-0">[{log.time}]</span>
              <span className={typeColor}>{log.msg}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
PlayerLogs.displayName = 'PlayerLogs';

// ============================================================================
// MAIN COMPONENT DEFINITION
// ============================================================================

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const loggerRef = useRef<PlayerLogsHandle>(null);
  
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const streamsRef = useRef<Stream[] | null>(null);
  const lastFailoverTimeRef = useRef(0);

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [failedServers, setFailedServers] = useState<Record<string, ServerFailureRecord>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: rawMatches } = useSWR(LIVE_EVENTS_API, fetcher, { revalidateOnFocus: false });
  
  const matches = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;
    return rawMatches.map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace('pro/', '').replace('.txt', '') : index.toString();
      return {
        id: matchId, links: rawEvent.links || '',
        eventInfo: {
          eventCat: rawEvent.category || 'Live Event', eventName: rawEvent.eventName || 'Live Match',
          teamA: rawEvent.teamAName || 'Team A', teamB: rawEvent.teamBName || 'Team B',
          startTime: '', endTime: '', link_names: rawEvent.link_names || [],
        },
      };
    });
  }, [rawMatches]);

  const currentMatch = useMemo(() => {
    if (!matches) return null;
    return matches.find((m: any) => String(m.id) === String(id)) || null;
  }, [matches, id]);

  const streamFetchUrl = useMemo(() => {
    if (currentMatch?.links) {
      const streamSlug = currentMatch.links.replace('pro/', '').replace('.txt', '');
      return `${STREAM_API_BASE}${streamSlug}`;
    }
    return null;
  }, [currentMatch]);

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, { revalidateOnFocus: false });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;
    const rawList = Array.isArray(streamsFromApi) ? streamsFromApi : streamsFromApi.streams || [];
    return rawList.filter((s: any) => s && (s.link || s.url)).map((s: any) => ({
      link: s.link || s.url || '', title: s.title, api: s.api,
    }));
  }, [streamsFromApi]);

  const currentStreamUrl = useMemo(() => streams?.[activeStreamIndex]?.link || null, [streams, activeStreamIndex]);

  useEffect(() => { streamsRef.current = streams; }, [streams]);
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 5000); return () => clearInterval(timer); }, []);

  const getMimeType = (url: string): string | undefined => {
    if (url.includes('.mpd')) return 'application/dash+xml';
    if (url.includes('.m3u8')) return 'application/x-mpegURL';
    return undefined;
  };

  const safeSwitchServer = useCallback(() => {
    const now = Date.now();
    if (now - lastFailoverTimeRef.current < CONFIG.failoverCooldown) return;
    lastFailoverTimeRef.current = now;

    setActiveStreamIndex((prevIndex) => {
      const list = streamsRef.current;
      if (!list) return prevIndex;
      
      loggerRef.current?.addLog(`Server ${prevIndex} failure registered. Finding next stream...`, 'warn');
      setFailedServers((p) => ({ ...p, [prevIndex]: { time: Date.now(), attempts: (p[prevIndex]?.attempts || 0) + 1 } }));

      const nextIdx = (prevIndex + 1) % list.length;
      if (nextIdx === 0) {
        loggerRef.current?.addLog('All parsed source options returned errors.', 'error');
        setAllServersDown(true);
        setIsBuffering(false);
      }
      return nextIdx;
    });
  }, []);

  // UNIFIED STREAMING CORE ENGINE
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || allServersDown || !currentStreamUrl || !streams?.length) {
      return;
    }

    let shaka: any; let player: any; let ui: any;
    let isMounted = true;

    const startStreaming = async () => {
      setIsBuffering(true);
      loggerRef.current?.addLog(`Engine Initializing for Server index: ${activeStreamIndex}`, 'info');

      try {
        if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
        if (playerRef.current) { await playerRef.current.destroy(); playerRef.current = null; }

        shaka = await import('shaka-player/dist/shaka-player.ui');
        if (!isMounted) return;
        shaka.polyfill.installAll();

        player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen'],
          addSeekBar: true,
        });

        player.configure({
          streaming: {
            bufferingGoal: 10, rebufferingGoal: 1, bufferBehind: 15,
            startAtSegmentBoundary: true, jumpLargeGaps: true,
            retryParameters: { maxAttempts: 5, baseDelay: 400, timeout: 8000 }
          }
        });

        player.addEventListener('buffering', (e: any) => { if (isMounted) setIsBuffering(e.buffering); });
        player.addEventListener('error', () => { if (isMounted) safeSwitchServer(); });

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
          loggerRef.current?.addLog(`Injecting extracted ClearKeys: ${JSON.stringify(clearKeysObj)}`, 'success');
          player.configure({ drm: { clearKeys: clearKeysObj } });
        }

        const mimeType = getMimeType(currentStreamUrl);
        await player.load(currentStreamUrl, null, mimeType);
        
        if (videoRef.current && isMounted) {
          videoRef.current.play().catch(() => {});
        }
        if (isMounted) setIsBuffering(false);

      } catch (err: any) {
        loggerRef.current?.addLog(`Critical Error: ${err.message || err}`, 'error');
        if (isMounted) safeSwitchServer();
      }
    };

    startStreaming();
    return () => { isMounted = false; };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams, safeSwitchServer]);

  const handleManualSwitch = (idx: number) => {
    loggerRef.current?.addLog(`User switched to Server: ${idx + 1}`, 'info');
    setAllServersDown(false);
    setActiveStreamIndex(idx);
  };

  const matchTitle = currentMatch?.eventInfo && `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}`;

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 outline-none">
              <span className="text-sm font-bold">Back to Home</span>
            </button>
          </Link>
          <span className="text-sm font-bold tracking-wide truncate max-w-xs">{matchTitle || 'Live Event'}</span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 mt-4">
        <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-xl overflow-hidden shadow-xl border border-gray-800 group">
          {isBuffering && !allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
              <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/95 z-50 flex-col gap-2 text-center p-4">
              <div className="text-red-400 font-bold">Stream Currently Unavailable</div>
              <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); setFailedServers({}); }} className="mt-2 bg-gray-900 border border-gray-700 text-white px-4 py-1.5 rounded-full text-xs">Reset Playback</button>
            </div>
          )}

          <video ref={videoRef} autoPlay playsInline className="w-full h-full" />
        </div>

        {streams && (
          <div className="flex gap-2 overflow-x-auto py-4 items-center scrollbar-hide">
            <span className="text-gray-400 font-bold text-xs uppercase mr-2">Servers:</span>
            {streams.map((stream, index) => {
              const serverName = stream.title || currentMatch?.eventInfo.link_names?.[index] || `Server ${index + 1}`;
              return (
                <button key={index} onClick={() => handleManualSwitch(index)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border ${activeStreamIndex === index && !allServersDown ? 'bg-[#1C1E2B] border-[#00E5FF] text-white' : 'bg-[#1C1E2B] border-gray-700/50 text-gray-400'}`}>
                  {serverName}
                </button>
              );
            })}
          </div>
        )}

        <PlayerLogs ref={loggerRef} />
      </div>
    </main>
  );
}
