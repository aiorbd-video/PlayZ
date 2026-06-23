'use client';

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

import {
  PlayerLogs,
  type PlayerLogsHandle,
} from '../../components/PlayerLogs';

import { useShakaEngine } from '../../media/hooks/useShakaEngine';

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

const LIVE_EVENTS_API =
  'https://ratulxadia-playz-cats-event.hf.space/api/events';

const STREAM_API_BASE =
  'https://ratulxadia-playz-cats-event.hf.space/api/stream/';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => r.json());

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loggerRef = useRef<PlayerLogsHandle>(null);

  const streamsRef = useRef<Stream[] | null>(null);

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);

  const [objectFit] = useState<'contain' | 'cover' | 'fill'>('contain');

  const lastSwitchRef = useRef(0);

  /* -------------------------
     MATCH DATA
  --------------------------*/
  const { data: matchesRaw } = useSWR(LIVE_EVENTS_API, fetcher, {
    revalidateOnFocus: false,
  });

  const matches = useMemo(() => {
    if (!Array.isArray(matchesRaw)) return null;

    return matchesRaw.map((item: any, i: number) => {
      const e = item.event || {};

      const id =
        e.links?.replace('pro/', '').replace('.txt', '') || i;

      return {
        id,
        links: e.links || '',
        eventInfo: {
          eventCat: e.category || 'Live',
          eventName: e.eventName || 'Match',
          teamA: e.teamAName || 'Team A',
          teamB: e.teamBName || 'Team B',
          startTime: '',
          endTime: '',
        },
      };
    });
  }, [matchesRaw]);

  const currentMatch = useMemo(() => {
    if (!matches) return null;
    return matches.find((m: any) => String(m.id) === String(id));
  }, [matches, id]);

  /* -------------------------
     STREAM API
  --------------------------*/
  const streamUrl = useMemo(() => {
    if (!currentMatch?.links) return null;

    const slug = currentMatch.links
      .replace('pro/', '')
      .replace('.txt', '');

    return `${STREAM_API_BASE}${slug}`;
  }, [currentMatch]);

  const { data: streamData } = useSWR(streamUrl, fetcher, {
    refreshInterval: 15000,
    dedupingInterval: 5000,
    revalidateOnFocus: false,
  });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamData) return null;

    const list = Array.isArray(streamData)
      ? streamData
      : streamData.streams || [];

    return list
      .filter((s: any) => s?.link || s?.url)
      .map((s: any) => ({
        link: s.link || s.url,
        title: s.title || s.name || '',
        api: s.api || '',
      }));
  }, [streamData]);

  const currentStreamUrl = useMemo(
    () => streams?.[activeStreamIndex]?.link || null,
    [streams, activeStreamIndex]
  );

  useEffect(() => {
    streamsRef.current = streams;
  }, [streams]);

  /* -------------------------
     SAFE SWITCH SERVER
  --------------------------*/
  const safeSwitchServer = useCallback(() => {
    const now = Date.now();

    if (now - lastSwitchRef.current < 1000) return;
    lastSwitchRef.current = now;

    setActiveStreamIndex((prev) => {
      const list = streamsRef.current;
      if (!list) return prev;

      const next = (prev + 1) % list.length;

      if (next === 0) {
        setAllServersDown(true);
      }

      loggerRef.current?.addLog(
        `Switching to server ${next + 1}`,
        'warn'
      );

      return next;
    });
  }, []);

  /* -------------------------
     SHAKA ENGINE (CLEAN)
  --------------------------*/
  useShakaEngine({
    currentStreamUrl,
    activeStreamIndex,
    streams,
    allServersDown,
    videoRef,
    videoContainerRef: containerRef,
    loggerRef,
    setIsBuffering,
    safeSwitchServer,
    getMimeType: (url: string) => {
      if (url.includes('.mpd')) return 'application/dash+xml';
      if (url.includes('.m3u8'))
        return 'application/x-mpegURL';
      return undefined;
    },
  });

  /* -------------------------
     UI EVENTS
  --------------------------*/
  const handleManualSwitch = (idx: number) => {
    setAllServersDown(false);
    setActiveStreamIndex(idx);
  };

  const matchTitle = currentMatch?.eventInfo
    ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}`
    : 'Live Match';

  /* -------------------------
     RENDER
  --------------------------*/
  return (
    <main className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <nav className="p-4 border-b border-gray-800">
        <div className="flex justify-between">
          <Link href="/">
            <button className="text-sm">← Back</button>
          </Link>
          <div className="text-sm font-bold">{matchTitle}</div>
          <div />
        </div>
      </nav>

      {/* PLAYER */}
      <div className="max-w-6xl mx-auto p-3">
        <div
          ref={containerRef}
          className="relative aspect-video bg-black rounded-xl overflow-hidden"
        >
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <p className="text-red-500">All Servers Failed</p>
            </div>
          )}

          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full"
            style={{ objectFit }}
          />
        </div>

        {/* SERVER LIST */}
        <div className="flex gap-2 mt-3 overflow-x-auto">
          {streams?.map((s, i) => (
            <button
              key={i}
              onClick={() => handleManualSwitch(i)}
              className={`px-3 py-1 text-xs rounded border ${
                i === activeStreamIndex
                  ? 'border-white'
                  : 'border-gray-700 text-gray-400'
              }`}
            >
              {s.title || `Server ${i + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* LOGS */}
      <div className="max-w-6xl mx-auto p-3">
        <PlayerLogs
          ref={loggerRef}
          matchTitle={matchTitle}
          matchObj={currentMatch}
        />
      </div>

      {/* ADS SCRIPT (optional) */}
      <Script
        src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js"
        strategy="lazyOnload"
      />
    </main>
  );
}
