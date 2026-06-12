'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import 'shaka-player/dist/controls.css';
import shaka from 'shaka-player/dist/shaka-player.ui';

// 🟢 টাইপ-সেফটির জন্য ইন্টারফেস সংজ্ঞায়িত করা হয়েছে
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

const MATCH_API = "https://ratulxlive.vercel.app/api/proxy-matches";
const IMG_PROXY = "https://img.aiorbd.workers.dev/?url=";

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;

    shaka.polyfill.installAll();
    if (shaka.Player.isBrowserSupported() && videoRef.current) {
        const player = new shaka.Player(videoRef.current);
        const ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        
        ui.configure({
            controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen', 'overflow_menu'],
            addSeekBar: true,
        });
        
        setPlayerInstance(player);
        setUiInstance(ui);
    }
  }, []);

  useEffect(() => {
    return () => {
      uiInstance?.destroy();
      playerInstance?.destroy();
    };
  }, [playerInstance, uiInstance]);

  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0) return;
    const currentStream = streams[activeStreamIndex] || streams[0];
    const streamUrl = currentStream.link;
    const drmKeyString = currentStream.api;

    if (playerInstance.getAssetUri() === streamUrl) return;

    const loadVideo = async () => {
      try {
        const playerConfig: shaka.extern.PlayerConfiguration = {
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
        console.error('Video Error:', e);
      }
    };
    loadVideo();
  }, [playerInstance, streams, activeStreamIndex]);

  return (
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-10">
      <nav className="p-3 bg-[#181a20] sticky top-0 z-50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-300 hover:text-white flex items-center gap-2 group outline-none focus:text-[#3498db]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              <span className="text-sm font-medium hidden sm:inline">Back to Home</span>
            </button>
          </Link>
          <span className="text-sm md:text-base font-bold text-gray-200 truncate max-w-xs sm:max-w-md tracking-wide">
            {currentMatch ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}` : "Live Streaming"}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 mt-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2 flex flex-col">
          <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-xl overflow-hidden shadow-xl border border-gray-800 shaka-video-container">
            {!streams && <div className="absolute inset-0 flex items-center justify-center bg-[#12141c]/90 z-10 flex-col gap-3"><div className="w-10 h-10 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin"></div><span className="text-gray-400 text-sm animate-pulse">Fetching Secure Stream...</span></div>}
            <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
          </div>

          {streams && streams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 my-2 border-b border-gray-800/50">
              <span className="text-gray-400 font-bold flex items-center text-sm mr-2 whitespace-nowrap">Servers:</span>
              {streams.map((stream, index) => (
                <button key={index} onClick={() => setActiveStreamIndex(index)} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 border outline-none ${activeStreamIndex === index ? "bg-[#1e2738] border-[#3498db] text-white" : "bg-[#1a1e29] border-transparent text-gray-400"}`}>
                  {stream.title || `Server ${index + 1}`}
                </button>
              ))}
            </div>
          )}

          {currentMatch ? (
            <div className="bg-[#1a1e29] border border-gray-800/80 rounded-xl p-5 mt-2">
              <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{currentMatch.eventInfo.eventName}</div>
              <div className="flex justify-center items-center gap-6 sm:gap-12">
                <div className="flex items-center gap-3">
                  <Image unoptimized src={getImg(currentMatch.eventInfo.teamAFlag)} width={32} height={32} className="rounded-full object-cover bg-gray-800" alt={currentMatch.eventInfo.teamA} /> 
                  <span className="font-bold text-sm md:text-base">{currentMatch.eventInfo.teamA}</span>
                </div>
                <span className="text-[#3498db] font-black italic text-sm">VS</span>
                <div className="flex items-center gap-3">
                  <Image unoptimized src={getImg(currentMatch.eventInfo.teamBFlag)} width={32} height={32} className="rounded-full object-cover bg-gray-800" alt={currentMatch.eventInfo.teamB} /> 
                  <span className="font-bold text-sm md:text-base">{currentMatch.eventInfo.teamB}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1e29] border border-gray-800/80 rounded-xl p-5 mt-2 animate-pulse flex justify-between items-center">
              <div className="h-4 bg-gray-800 rounded w-1/3"></div>
              <div className="h-4 bg-gray-800 rounded w-1/4"></div>
            </div>
          )}
        </div>

        <div className="mt-6 lg:mt-0 lg:col-span-1 max-h-[70vh] lg:max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide pr-1">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1 mb-1">More Live Events</span>
            {matches && matches.map((match) => {
              const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
              const isCurrent = match.id.toString() === id;

              return (
                <Link href={`/watch/${match.id}`} key={match.id} className="outline-none" prefetch={false}>
                  <div className={`bg-[#1a1e29] border rounded-xl p-4 transition-all hover:bg-[#1e2738]/30 ${isCurrent ? 'border-[#3498db] bg-[#1e2738]/50' : 'border-gray-800/60'}`}>
                    <div className="text-[11px] text-gray-400 mb-2 truncate uppercase tracking-wide">{match.eventInfo.eventCat} • {match.eventInfo.eventName}</div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 truncate max-w-[40%]">
                        <Image unoptimized src={getImg(match.eventInfo.teamAFlag)} width={16} height={16} className="rounded-full min-w-[16px]" alt={match.eventInfo.teamA} />
                        <span className="text-xs font-semibold truncate text-gray-200">{match.eventInfo.teamA}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide shrink-0 ${status.type === 'live' ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse' : 'bg-blue-500/10 text-blue-400'}`}>{status.label}</span>
                      <div className="flex items-center gap-2 truncate max-w-[40%] justify-end">
                        <span className="text-xs font-semibold truncate text-gray-200 text-right">{match.eventInfo.teamB}</span>
                        <Image unoptimized src={getImg(match.eventInfo.teamBFlag)} width={16} height={16} className="rounded-full min-w-[16px]" alt={match.eventInfo.teamB} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
