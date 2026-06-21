'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

interface Stream { title?: string; link: string; api?: string; }
const LIVE_EVENTS_API = process.env.NEXT_PUBLIC_LIVE_EVENTS_API || "https://ratulxadia-playz-cats-event.hf.space/api/events";
const STREAM_API_BASE = process.env.NEXT_PUBLIC_STREAM_API_BASE || "https://ratulxadia-playz-cats-event.hf.space/api/stream/";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerInitRef = useRef(false);

  const currentlyPlayingUrlRef = useRef<string | null>(null);
  const lastAppliedDrmRef = useRef<string | null>(null); 
  const lastSwitchTimeRef = useRef<number>(0); 
  const timersRef = useRef<Set<any>>(new Set());

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);

  const { data: rawMatches } = useSWR(LIVE_EVENTS_API, fetcher, { revalidateOnFocus: false });

  const currentMatch = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;
    return rawMatches.find((item: any, idx: number) => {
      const e = item.event || {};
      const mId = e.links ? e.links.replace("pro/", "").replace(".txt", "") : idx.toString();
      return mId === id || id.endsWith(mId);
    })?.event;
  }, [rawMatches, id]);

  const streamFetchUrl = useMemo(() => {
    if (!currentMatch?.links) return null;
    return `${STREAM_API_BASE}${currentMatch.links.replace("pro/", "").replace(".txt", "")}`;
  }, [currentMatch]);

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, { revalidateOnFocus: false });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;
    const list = Array.isArray(streamsFromApi) ? streamsFromApi : (streamsFromApi.streams || []);
    return list.filter((s: any) => s && (s.link || s.url)).map((s: any) => ({
      link: s.link || s.url || "", title: s.title, api: s.api
    }));
  }, [streamsFromApi]);

  const currentStreamUrl = useMemo(() => {
    if (!streams?.length) return null;
    return streams[activeStreamIndex]?.link || null;
  }, [streams, activeStreamIndex]);

  // Instant Auto Switcher: যেকোনো এরর বা স্টল খাওয়া মাত্র পরবর্তী সার্ভারে শিফট করার চাবি
  const safeSwitchServer = useCallback(() => {
    const now = Date.now();
    if (now - lastSwitchTimeRef.current < 800) return; // Fast throttle guard
    lastSwitchTimeRef.current = now;

    setActiveStreamIndex((prev) => {
      if (!streams || streams.length <= 1) return prev;
      const nextIndex = (prev + 1) % streams.length;
      if (nextIndex === 0) {
        setAllServersDown(true);
        setIsBuffering(false);
        return prev;
      }
      return nextIndex;
    });
  }, [streams]);
  // Block 1: প্লেয়ার লাইফসাইকেল ইনিশিয়ালাইজেশন (ব্রাউজারে শুধু একবারই রান হবে)
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || playerInitRef.current) return;
    playerInitRef.current = true;

    let shaka: any; let ui: any; let player: any;

    const init = async () => {
      try {
        shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();

        player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen'],
          addSeekBar: true
        });

        player.configure({
          streaming: { 
            bufferingGoal: 10, 
            rebufferingGoal: 2,
            retryParameters: { maxAttempts: 3, baseDelay: 500, timeout: 10000 } 
          }
        });

        player.addEventListener('buffering', (e: any) => {
          setIsBuffering(e.buffering);
          if (e.buffering) {
            const t = setTimeout(() => {
              if (playerRef.current?.isBuffering()) safeSwitchServer();
            }, 6000); // ৬ সেকেন্ড বাফারিং এ আটকে থাকলে অটো সার্ভার চেঞ্জ হবে
            timersRef.current.add(t);
          }
        });

        player.addEventListener('error', () => safeSwitchServer());

      } catch (e) {
        playerInitRef.current = false;
      }
    };

    init();

    return () => {
      playerInitRef.current = false;
      if (ui) ui.destroy();
      if (player) { try { player.destroy(); } catch(err){} }
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
    };
  }, [safeSwitchServer]);

  // Block 2: ভিডিও ও DRM লোড ইঞ্জিন (সার্ভার ইনডেক্স বা ইউআরএল চেঞ্জ হলে রিফ্রেশ ছাড়াই সাথে সাথে ফায়ার হবে)
  useEffect(() => {
    if (!playerRef.current || !currentStreamUrl || !streams) return;
    if (currentlyPlayingUrlRef.current === currentStreamUrl) return;

    const loadVideo = async () => {
      setIsBuffering(true);
      try {
        await playerRef.current.unload();

        const currentStreamObj = streams[activeStreamIndex];
        const newDrmApi = currentStreamObj?.api || "";

        if (lastAppliedDrmRef.current !== newDrmApi) {
          if (newDrmApi) {
            const parts = newDrmApi.replace(/['"\s{}]/g, '').split(':');
            if (parts.length >= 2) {
              playerRef.current.configure({ drm: { clearKeys: { [parts[0]]: parts.slice(1).join(':') } } });
            }
          } else {
            playerRef.current.configure({ drm: { clearKeys: {} } });
          }
          lastAppliedDrmRef.current = newDrmApi;
        }

        const mimeType = currentStreamUrl.includes('.mpd') ? 'application/dash+xml' : currentStreamUrl.includes('.m3u8') ? 'application/x-mpegURL' : undefined;
        
        await playerRef.current.load(currentStreamUrl, null, mimeType);
        currentlyPlayingUrlRef.current = currentStreamUrl;
        setIsBuffering(false);
      } catch (error) {
        safeSwitchServer();
      }
    };

    loadVideo();
  }, [currentStreamUrl, activeStreamIndex, streams, safeSwitchServer]);

  return (
    <div className="w-full flex flex-col p-2 sm:p-4 bg-[#11131A]">
      <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-2xl border border-gray-800/60 shaka-video-container">
        
        {isBuffering && !allServersDown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-40">
            <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {allServersDown && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#11131A] z-50 flex-col gap-3 p-4 text-center">
            <span className="text-red-400 font-bold">All Server Connections Failed</span>
            <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); currentlyPlayingUrlRef.current = null; }} className="bg-[#1C1E2B] text-white border border-gray-700 px-5 py-2 rounded-full text-xs font-bold">Reset Pipe Matrix</button>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline className="w-full h-full" style={{ objectFit }} />
      </div>

      {streams && streams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-4 items-center scrollbar-hide">
          <span className="text-gray-400 font-bold text-xs uppercase tracking-wider mr-2">Servers:</span>
          {streams.map((stream, idx) => {
            const name = stream.title || `Server ${idx + 1}`;
            return (
              <button key={idx} onClick={() => { setActiveStreamIndex(idx); currentlyPlayingUrlRef.current = null; }} className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${activeStreamIndex === idx && !allServersDown ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]" : "bg-[#1C1E2B] border-gray-800 text-gray-400"}`}>
                {name}
              </button>
            );
          })}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .shaka-scrim-container { display: none !important; }
      `}} />
      <Script src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js" strategy="lazyOnload" id="adsterra-popunder" />
    </div>
  );
}
