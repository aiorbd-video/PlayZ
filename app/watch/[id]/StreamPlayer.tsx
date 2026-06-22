'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';

import { PlayerLogs, type PlayerLogsHandle } from '../../components/PlayerLogs';
import { useShakaEngine } from '../../hooks/useShakaEngine';

interface Stream { title?: string; link: string; api?: string; }
interface EventInfo { eventCat: string; eventName: string; teamA: string; teamB: string; startTime: string; endTime: string; link_names?: string[]; }
interface Match { id: number | string; eventInfo: EventInfo; links?: string; }
interface ServerFailureRecord { time: number; attempts: number; }

const LIVE_EVENTS_API = 'https://ratulxadia-playz-cats-event.hf.space/api/events';
const STREAM_API_BASE = 'https://ratulxadia-playz-cats-event.hf.space/api/stream/';

const CONFIG = {
  failoverCooldown: 1000,
  serverBlacklistDuration: 20000,
} as const;

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const loggerRef = useRef<PlayerLogsHandle>(null);

  const streamsRef = useRef<Stream[] | null>(null);
  const lastFailoverTimeRef = useRef(0);
  const timersRef = useRef<Set<any>>(new Set());

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [failedServers, setFailedServers] = useState<Record<string, ServerFailureRecord>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);

  const handleFitToggle = useCallback(() => {
    const fitModes = ['contain', 'cover', 'fill'] as const;
    setObjectFit((prev) => {
      const next = fitModes[(fitModes.indexOf(prev) + 1) % fitModes.length];
      setShowFitToast(true);
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('toggleObjectFit', handleFitToggle);
    return () => window.removeEventListener('toggleObjectFit', handleFitToggle);
  }, [handleFitToggle]);

  useEffect(() => {
    if (showFitToast) {
      const timer = setTimeout(() => setShowFitToast(false), 2000);
      timersRef.current.add(timer);
      return () => { clearTimeout(timer); timersRef.current.delete(timer); };
    }
  }, [showFitToast]);

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

  // 🎯 ফিক্সড: s.name কে টাইটেল হিসেবে বাইন্ড করা হলো যাতে সর্টিং এর পর নাম ওলটপালট না হয়
  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;
    const rawList = Array.isArray(streamsFromApi) ? streamsFromApi : streamsFromApi.streams || [];
    
    const parsedStreams = rawList.filter((s: any) => s && (s.link || s.url)).map((s: any) => ({
      link: s.link || s.url || '', 
      title: s.name || s.title || '', 
      api: s.api,
    }));

    return parsedStreams.sort((a: Stream, b: Stream) => {
      const aIsDash = a.link.includes('.mpd') ? 1 : 0;
      const bIsDash = b.link.includes('.mpd') ? 1 : 0;
      return bIsDash - aIsDash;
    });
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
      
      loggerRef.current?.addLog(`Server [${prevIndex + 1}] stream dead. Swapping link...`, 'warn');
      setFailedServers((p) => ({ ...p, [prevIndex]: { time: Date.now(), attempts: (p[prevIndex]?.attempts || 0) + 1 } }));

      const nextIdx = (prevIndex + 1) % list.length;
      if (nextIdx === 0) {
        loggerRef.current?.addLog('Matrix Status: All options returned runtime errors.', 'error');
        setAllServersDown(true);
        setIsBuffering(false);
      }
      return nextIdx;
    });
  }, []);

  useShakaEngine({
    currentStreamUrl, activeStreamIndex, streams, allServersDown,
    videoRef, videoContainerRef, loggerRef, setIsBuffering, safeSwitchServer, getMimeType
  });

  const handleManualSwitch = (idx: number) => {
    loggerRef.current?.addLog(`Manual Server Swap Triggered to Pipe index: ${idx + 1}`, 'info');
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

          <video ref={videoRef} autoPlay playsInline className="w-full h-full" style={{ objectFit }} />

          <AnimatePresence>
            {showFitToast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="absolute top-6 left-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700/50 shadow-xl z-50 flex items-center gap-2 pointer-events-none"
              >
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                <span className="text-xs md:text-sm font-bold text-white capitalize">
                  {objectFit === 'contain' ? 'Fit to Screen' : objectFit === 'cover' ? 'Zoom (Cropped)' : 'Stretch (Fill)'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {streams && (
          <div className="flex gap-2 overflow-x-auto py-4 items-center scrollbar-hide">
            <span className="text-gray-400 font-bold text-xs uppercase mr-2">Servers:</span>
            {streams.map((stream, index) => {
              // 🎯 ফিক্সড: সরাসরি অবজেক্ট থেকে ম্যাপড টাইটেল রিড করা হচ্ছে
              const serverName = stream.title || `Server ${index + 1}`;
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

      <style dangerouslySetInnerHTML={{
        __html: `
          .shaka-custom-stretch-btn {
            background: transparent; border: none; color: white; cursor: pointer; padding: 5px; opacity: 0.8; display: flex; align-items: center; justify-content: center;
          }
          .shaka-custom-stretch-btn:hover { opacity: 1; }
        `
      }} />
    </main>
  );
      }
