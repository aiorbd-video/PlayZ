'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion'; // পিসি ক্লিক অ্যানিমেশনের জন্য মোশন যুক্ত করা হলো
import 'shaka-player/dist/controls.css';
import shaka from 'shaka-player/dist/shaka-player.ui';

interface Stream {
  link: string;
  api: string;
  title: string;
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
}

interface Match {
  id: number | string;
  eventInfo: EventInfo;
}

interface ApiResponse {
  streams: Stream[] | null;
}

const MATCH_API = "/api/proxy-matches"; // 🟢 ডোমেইন হার্ডকোড বাদ দিয়ে রিলেটিভ পাথ করা হলো লোকাল ও প্রোড সেফটির জন্য
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined) => {
  if (!url || url === "null") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return { type: "upcoming", label: "TBA" };
  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  if (currentTime > endTime) return { type: "ended", label: "Ended" };
  else if (currentTime >= startTime && currentTime <= endTime) return { type: "live", label: "LIVE" };
  else return { type: "upcoming", label: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
};

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<shaka.Player | null>(null);
  const [uiInstance, setUiInstance] = useState<shaka.ui.Overlay | null>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 🟢 ফিক্স ১: ৫ সেকেন্ড পর পর টাইম রিফ্রেশ হবে যাতে ডানপাশের লিস্টের লাইভ ব্যাজ ইনস্ট্যান্ট সিঙ্ক হয়
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  // 🟢 ফিক্স ২: ইউজার যখন অন্য ম্যাচে ক্লিক করবে, সার্ভার ইনডেক্স অটো রিসেট হয়ে ০ হবে (ক্র্যাশ প্রটেকশন)
  useEffect(() => {
    setActiveStreamIndex(0);
  }, [id]);

  const { data: matches } = useSWR<Match[]>(MATCH_API, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  });
  
  const currentMatch = matches?.find((m) => m.id.toString() === id);
  
  const { data: apiResponse } = useSWR<ApiResponse>(`/api/streams/${id}`, fetcher, { 
    refreshInterval: 10000,
    revalidateOnFocus: false
  });
  const streams = apiResponse?.streams || null;

  // 🟢 ফিক্স ৩: শাকাপ্লেয়ার ইনিশিয়ালাইজেশন এবং ডেসট্রাকশন একসাথে এক ইফেক্টে মার্জ করা হলো (Strict Mode Safe)
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
        
        // প্লেয়ার এরর লিসেনার (কোনো কারণে স্ট্রিম ফেল করলে কনসোলে ট্র্যাক করার জন্য)
        player.addEventListener('error', (event: any) => {
          console.error('Shaka Player Internal Error:', event.detail);
        });

        setPlayerInstance(player);
        setUiInstance(ui);
    }

    return () => {
      if (ui) ui.destroy();
      if (player) player.destroy();
    };
  }, []);

  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0) return;
    
    // সেফগার্ড ইনডেক্স চেকিং
    const currentStream = streams[activeStreamIndex] || streams[0];
    if (!currentStream) return;

    const streamUrl = currentStream.link;
    const drmKeyString = currentStream.api;

    if (playerInstance.getAssetUri() === streamUrl) return;

    const loadVideo = async () => {
      try {
        const playerConfig: any = {
          streaming: {
              bufferingGoal: 30,
              rebufferingGoal: 5,
              bufferBehind: 15,
              retryParameters: {
                  maxAttempts: 7,
                  baseDelay: 1000,
                  backoffFactor: 2,
                  fuzzFactor: 0.5,
                  timeout: 30000,
                  stallTimeout: 5000,
                  connectionTimeout: 10000
              }
          },
          abr: { enabled: true, defaultBandwidthEstimate: 1000000 },
          manifest: { dash: { ignoreMinBufferTime: true } }
        };
        if (drmKeyString && drmKeyString.includes(':')) {
          const [kid, key] = drmKeyString.split(':');
          playerConfig.drm = { clearKeys: { [kid]: key } };
        }
        playerInstance.configure(playerConfig);
        await playerInstance.load(streamUrl);
      } catch (e) {
        console.error('Video Loading Failed:', e);
      }
    };
    loadVideo();
  }, [playerInstance, streams, activeStreamIndex]);

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
      
      {/* প্রিমিয়াম ন্যাভ বার */}
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 group outline-none transition-colors active:scale-[0.95]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-bold hidden sm:inline">Back to Home</span>
            </button>
          </Link>
          <span className="text-sm md:text-base font-bold text-gray-100 truncate max-w-xs sm:max-w-md tracking-wide">
            {currentMatch ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}` : "Live Streaming"}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 mt-4 lg:grid lg:grid-cols-3 lg:gap-6">
        {/* বাম সেকশন: ভিডিও প্লেয়ার এবং ম্যাচ কার্ড ডিটেইলস */}
        <div className="lg:col-span-2 flex flex-col">
          
          {/* ভিডিও উইন্ডো */}
          <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-xl border border-gray-800 shaka-video-container">
            {!streams && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/90 z-10 flex-col gap-3">
                <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-400 text-sm animate-pulse">Fetching Secure Stream...</span>
              </div>
            )}
            <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
          </div>

          {/* 🟢 সার্ভার বাটন গ্রুপ (পিসির জন্য সলিড অ্যাক্টিভ ক্লিক ফিল যুক্ত করা হলো) */}
          {streams && streams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-4 my-2 border-b border-gray-800/40 items-center">
              <span className="text-gray-400 font-bold text-xs md:text-sm mr-2 whitespace-nowrap uppercase tracking-wider">Servers:</span>
              {streams.map((stream, index) => (
                <button 
                  key={index} 
                  onClick={() => setActiveStreamIndex(index)} 
                  className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border outline-none active:scale-[0.95] duration-150 ${
                    activeStreamIndex === index 
                      ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-md shadow-[#00E5FF]/10 ring-2 ring-[#00E5FF]/20" 
                      : "bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white active:border-[#00E5FF]"
                  }`}
                >
                  {stream.title || `Server ${index + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* কারেন্ট ম্যাচ ইনফো কার্ড */}
          {currentMatch ? (
            <div className="bg-[#1C1E2B] border border-[#00E5FF]/40 rounded-[20px] p-5 mt-3 shadow-lg">
              <div className="text-center text-xs font-bold text-[#00E5FF] uppercase tracking-widest mb-4">
                {currentMatch.eventInfo.eventCat} | {currentMatch.eventInfo.eventName}
              </div>
              <div className="flex justify-center items-center gap-6 sm:gap-12 py-2">
                <div className="flex items-center gap-3 w-[40%] justify-end">
                  <span className="font-bold text-sm md:text-base text-gray-200 text-right truncate">{currentMatch.eventInfo.teamA}</span>
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700/50 flex-shrink-0 relative">
                    <Image unoptimized src={getImg(currentMatch.eventInfo.teamAFlag)} fill className="object-cover" alt="" />
                  </div>
                </div>
                <span className="text-gray-400 font-black italic text-sm md:text-base px-2">VS</span>
                <div className="flex items-center gap-3 w-[40%] justify-start">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700/50 flex-shrink-0 relative">
                    <Image unoptimized src={getImg(currentMatch.eventInfo.teamBFlag)} fill className="object-cover" alt="" />
                  </div>
                  <span className="font-bold text-sm md:text-base text-gray-200 text-left truncate">{currentMatch.eventInfo.teamB}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1C1E2B] border border-gray-800/60 rounded-[20px] p-5 mt-3 animate-pulse flex justify-between items-center">
              <div className="h-4 bg-gray-800 rounded w-1/3"></div>
              <div className="h-4 bg-gray-800 rounded w-1/4"></div>
            </div>
          )}
        </div>

        {/* ডান সেকশন: মোর লাইভ ইভেন্টস লিস্ট (পিসি ক্লিক ফিডব্যাক `motion.div` ও `whileTap` সহ) */}
        <div className="mt-6 lg:mt-0 lg:col-span-1 max-h-[70vh] lg:max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide pr-1">
          <div className="flex flex-col gap-3.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 pl-1 mb-1">More Live Events</span>
            {matches && matches.map((match) => {
              const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
              const isCurrent = match.id.toString() === id;

              return (
                <Link href={`/watch/${match.id}`} key={match.id} className="outline-none" prefetch={false}>
                  {/* 🟢 ফিক্স ৪: সাইডবার কার্ডে ট্যাপ/ক্লিক ইফেক্ট যুক্ত করা হলো */}
                  <motion.div 
                    whileTap={{ scale: 0.97 }}
                    className={`bg-[#1C1E2B] border rounded-[18px] p-4 transition-all duration-150 active:scale-[0.97] ${
                      isCurrent 
                        ? 'border-[#00E5FF] shadow-md shadow-[#00E5FF]/5 ring-2 ring-[#00E5FF]/10' 
                        : 'border-gray-800/80 hover:border-[#00E5FF]/40 active:border-[#00E5FF]'
                    }`}
                  >
                    <div className="text-[11px] text-gray-400 mb-2 truncate uppercase tracking-wide">
                      {match.eventInfo.eventCat} • {match.eventInfo.eventName}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 truncate max-w-[40%]">
                        <img src={getImg(match.eventInfo.teamAFlag)} className="w-5 h-5 rounded-full object-cover border border-gray-700/40 min-w-[20px]" alt="" />
                        <span className="text-xs font-bold truncate text-gray-200">{match.eventInfo.teamA}</span>
                      </div>
                      
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0 ${
                        status.type === 'live' 
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' 
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                      }`}>
                        {status.label}
                      </span>
                      
                      <div className="flex items-center gap-2 truncate max-w-[40%] justify-end">
                        <span className="text-xs font-bold truncate text-gray-200 text-right">{match.eventInfo.teamB}</span>
                        <img src={getImg(match.eventInfo.teamBFlag)} className="w-5 h-5 rounded-full object-cover border border-gray-700/40 min-w-[20px]" alt="" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
