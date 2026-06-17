'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import shaka from 'shaka-player/dist/shaka-player.ui';

const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined | null) => {
  if (!url || url === "null" || url === "Null") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

export default function TvPlayer() {
  const params = useParams();
  const id = params.id as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<shaka.Player | null>(null);

  // 🟢 সব চ্যানেল ফেচ করা হচ্ছে নিচের লিস্টে দেখানোর জন্য
  const { data, error } = useSWR('/api/channels', fetcher);
  const channels = data?.channels || [];
  const channel = channels.find((c: any) => c.id === id);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;

    shaka.polyfill.installAll();
    let player: shaka.Player | null = null;
    let ui: shaka.ui.Overlay | null = null;

    if (shaka.Player.isBrowserSupported()) {
        player = new shaka.Player(videoRef.current);
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        
        ui.configure({
            controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen', 'overflow_menu'],
            addSeekBar: true,
        });

        setPlayerInstance(player);
    }

    return () => {
      if (ui) ui.destroy();
      if (player) player.destroy();
    };
  }, []);

  useEffect(() => {
    if (!playerInstance || !channel) return;

    const streamUrl = channel.link;
    const drmKeyString = channel.api;

    const loadVideo = async () => {
      try {
        const playerConfig: any = {
          streaming: {
              bufferingGoal: 30,
              rebufferingGoal: 5,
              retryParameters: { maxAttempts: 5, baseDelay: 1000 }
          }
        };
        if (drmKeyString && drmKeyString.includes(':')) {
          const [kid, key] = drmKeyString.split(':');
          playerConfig.drm = { clearKeys: { [kid]: key } };
        }
        playerInstance.configure(playerConfig);
        await playerInstance.load(streamUrl);
      } catch (e) {
        console.error("Channel Load Error", e);
      }
    };
    loadVideo();
  }, [playerInstance, channel]);

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 group outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-bold hidden sm:inline">Back to Home</span>
            </button>
          </Link>
          <span className="text-base font-bold text-[#00E5FF] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {channel?.name || "Live TV"}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div 
          ref={videoContainerRef} 
          className="w-full max-w-5xl mx-auto bg-black aspect-video relative rounded-[20px] overflow-hidden shadow-xl border border-gray-800/80 shaka-video-container"
        >
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline />
        </div>

        {/* 🟢 নতুন সেকশন: প্লেয়ারের নিচে অন্য সব চ্যানেল গ্রিড (আপনার আসল ডিজাইনে) */}
        <div className="max-w-7xl mx-auto mt-10">
          <h2 className="text-xs md:text-sm font-black text-[#00E5FF] uppercase tracking-widest mb-6 pl-1 flex items-center gap-2">
            <span className="text-red-500 animate-pulse">●</span> Other Sports Channels
          </h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
            {channels.map((ch: any) => (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.95 }}>
                <Link href={`/tv/${ch.id}`} className="outline-none block">
                  <div className={`bg-[#1C1E2B] border rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] h-full min-h-[140px] group ${ch.id === id ? 'border-[#00E5FF] ring-1 ring-[#00E5FF]/30' : 'border-gray-800/80'}`}>
                    <div className="w-14 h-14 rounded-full bg-black/40 border border-gray-700/50 p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110 relative">
                      <Image src={getImg(ch.logo)} alt={ch.name} fill className="object-contain rounded-full p-0.5" unoptimized />
                    </div>
                    <span className="font-bold text-xs md:text-sm text-gray-200 group-hover:text-white text-center truncate w-full">{ch.name}</span>
                    {ch.id === id && <span className="text-[9px] px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded-full font-bold">Playing</span>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
