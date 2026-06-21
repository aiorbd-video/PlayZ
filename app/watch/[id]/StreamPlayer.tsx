'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

interface Stream { title?: string; link: string; api?: string; }
const LIVE_EVENTS_API = process.env.NEXT_PUBLIC_LIVE_EVENTS_API || "https://ratulxadia-playz-cats-event.hf.space/api/events";
const STREAM_API_BASE = process.env.NEXT_PUBLIC_STREAM_API_BASE || "https://ratulxadia-playz-cats-event.hf.space/api/stream/";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerInitRef = useRef(false);

  const currentlyPlayingUrlRef = useRef<string | null>(null);
  const lastAppliedDrmRef = useRef<string | null>(null);
  const lastSwitchTimeRef = useRef<number>(0);

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [failedServers, setFailedServers] = useState<Record<number, number>>({});
  const failedServersRef = useRef<Record<number, number>>({});

  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');

  // 🎯 ফিক্স ৩: সার্ভারের আসল নাম বের করার জন্য Data Fetching
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

  // 🎯 ফিক্স ১: Auto Switcher এখন পারফেক্টলি ফেইল হওয়া সার্ভারগুলোকে স্কিপ করবে
  const safeSwitchServer = useCallback(() => {
    const now = Date.now();
    if (now - lastSwitchTimeRef.current < 2000) return; // Prevent crazy fast loops
    lastSwitchTimeRef.current = now;

    setActiveStreamIndex((prev) => {
      if (!streams || streams.length <= 1) return prev;

      // বর্তমান সার্ভারকে ফেইল লিস্টে ঢোকানো হলো
      const updatedFails = { ...failedServersRef.current, [prev]: now };
      failedServersRef.current = updatedFails;
      setFailedServers(updatedFails);

      // পরবর্তী ভালো সার্ভার খোঁজা হচ্ছে
      let nextIdx = -1;
      for (let i = 1; i <= streams.length; i++) {
        const checkIdx = (prev + i) % streams.length;
        const failTime = updatedFails[checkIdx];
        
        // যদি ফেইল না করে থাকে অথবা ফেইল করার পর ৩০ সেকেন্ড পার হয়ে থাকে
        if (!failTime || (now - failTime > 30000)) {
          nextIdx = checkIdx;
          break;
        }
      }

      if (nextIdx !== -1) {
        return nextIdx;
      } else {
        setAllServersDown(true);
        setIsBuffering(false);
        return prev;
      }
    });
  }, [streams]);

  // 🎯 ফিক্স ২: ম্যানুয়ালি ক্লিক করলে সার্ভারটিকে ফেইল লিস্ট থেকে মুছে প্লে করার সুযোগ দেওয়া
  const handleManualSwitch = (idx: number) => {
    const newFails = { ...failedServersRef.current };
    delete newFails[idx];
    failedServersRef.current = newFails;
    setFailedServers(newFails);

    setActiveStreamIndex(idx);
    currentlyPlayingUrlRef.current = null;
    setAllServersDown(false);
  };
  // 🎯 ফিক্স ১.১: বাফারিং টাইমার ফিক্স - প্লে হলে টাইমার ক্যানসেল হয়ে যাবে!
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || playerInitRef.current) return;
    playerInitRef.current = true;

    let shaka: any; let ui: any; let player: any;
    let buffTimer: any = null;

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
            // ৮ সেকেন্ড বাফারিংয়ে আটকে থাকলে তবেই সুইচ করবে
            buffTimer = setTimeout(() => {
              if (playerRef.current?.isBuffering()) safeSwitchServer();
            }, 8000); 
          } else {
            // 🟢 ভিডিও প্লে হয়ে গেলে টাইমার ক্যানসেল! (অটো জাম্প আর করবে না)
            if (buffTimer) clearTimeout(buffTimer);
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
      if (buffTimer) clearTimeout(buffTimer);
      if (ui) ui.destroy();
      if (player) { try { player.destroy(); } catch(err){} }
    };
  }, [safeSwitchServer]);

  // Video Load Engine
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
            <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); currentlyPlayingUrlRef.current = null; failedServersRef.current = {}; setFailedServers({}); }} className="bg-[#1C1E2B] text-white border border-gray-700 px-5 py-2 rounded-full text-xs font-bold">Retry Servers</button>
          </div>
        )}

        <video ref={videoRef} autoPlay playsInline className="w-full h-full" style={{ objectFit }} />
      </div>

      {streams && streams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-4 items-center scrollbar-hide">
          <span className="text-gray-400 font-bold text-xs uppercase tracking-wider mr-2">Servers:</span>
          {streams.map((stream, idx) => {
            // 🎯 ফিক্স ৩: হারানো সার্ভার নেম ফিরিয়ে আনা হলো!
            const name = stream.title || currentMatch?.link_names?.[idx] || `Server ${idx + 1}`;
            const isFailed = !!failedServers[idx] && (Date.now() - failedServers[idx] < 30000);
            
            return (
              <button key={idx} onClick={() => handleManualSwitch(idx)} className={`px-5 py-2 rounded-full text-xs font-bold transition-all border ${activeStreamIndex === idx && !allServersDown ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]" : isFailed ? "bg-red-900/20 border-red-900/50 text-red-500/50" : "bg-[#1C1E2B] border-gray-800 text-gray-400 hover:text-white"}`}>
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
    </div>
  );
}
