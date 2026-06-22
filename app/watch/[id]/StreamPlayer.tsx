'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';

// 🎯 ফিক্সড: PlayerLogsHandle টাইপটি এখানে সফলভাবে ইম্পোর্ট করা হলো
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

  useShakaEngine({
    currentStreamUrl, activeStreamIndex, streams, allServersDown,
    videoRef, videoContainerRef, loggerRef, setIsBuffering, safeSwitchServer, getMimeType
  });

  const handleManualSwitch = (idx: number) => {
    loggerRef.current?.addLog(`User manually requested jump to Server index: ${idx}`, 'info');
    setAllServersDown(false);
    setActiveStreamIndex(idx);
  };
