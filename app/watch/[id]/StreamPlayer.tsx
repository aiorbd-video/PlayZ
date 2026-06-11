'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string) => {
  if (!url || url === "null") return "";
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
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveStreamIndex(0);
  }, [id]);

  const { data: matches } = useSWR(MATCH_API, fetcher);
  const currentMatch = matches?.find((m: any) => m.id.toString() === id);
  
  const { data: apiResponse } = useSWR(`/api/streams/${id}`, fetcher, { refreshInterval: 5000 });
  const streams = apiResponse?.streams || null;

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;
    let player: any;
    let ui: any;

    import('shaka-player/dist/shaka-player.ui.js').then((module) => {
      const shaka = module as any;
      shaka.polyfill.installAll();

      if (shaka.Player.isBrowserSupported()) {
        player = new shaka.Player(videoRef.current);
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen', 'overflow_menu'],
          addSeekBar: true,
        });
        setPlayerInstance(player);
      }
    });

    return () => {
      if (player) player.destroy();
      if (ui) ui.destroy();
    };
  }, []);

  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0) return;
    const currentStream = streams[activeStreamIndex] || streams[0];
    const streamUrl = currentStream.link;
    const drmKeyString = currentStream.api;

    const loadVideo = async () => {
      try {
        await playerInstance.unload();
        const playerConfig: any = {
          streaming: {
            bufferingGoal: 30,       
            rebufferingGoal: 5,      
            bufferBehind: 15,        
            retryParameters: {
              maxAttempts: 7,        
              baseDelay: 1000,
              backoffFactor: 2,
            }
          },
          abr: { enabled: true, defaultBandwidthEstimate: 1000000 },
          manifest: { dash: { ignoreMinBufferTime: true } }
        };

        if (drmKeyString && drmKeyString.includes(':')) {
          const [kid, key] = drmKeyString.split(':');
          playerConfig.drm = { clearKeys: { [kid]: key } };
        } else {
          playerConfig.drm = { clearKeys: {} };
        }

        playerInstance.configure(playerConfig);
        await playerInstance.load(streamUrl);
      } catch (e) {
        console.error('Video Error:', e);
      }
    };
    loadVideo();
  }, [playerInstance, streams, activeStreamIndex, id]); 

  return (
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-10">
      <nav className="p-3 bg-[#181a20] sticky top-0 z-50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-300 hover:text-white flex items-center gap-2 group outline-none focus:text-[#3498db]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
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
          <div className="w-full bg-black aspect-video relative rounded-none sm:rounded-xl overflow-hidden shadow-xl border border-gray-800">
            {!streams && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#12141c]/90 z-10 flex-col gap-3">
                <div className="w-10 h-10 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-400 text-sm animate-pulse">Fetching Secure Stream...</span>
              </div>
            )}
            <div ref={videoContainerRef} className="w-full h-full">
              <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
            </div>
          </div>

          {streams && streams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 my-2 border-b border-gray-800/50">
              <span className="text-gray-400 font-bold flex items-center text-sm mr-2 whitespace-nowrap">Servers:</span>
              {streams.map((stream: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setActiveStreamIndex(index)}
                  className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 border outline-none ${
                    activeStreamIndex === index ? "bg-[#1e2738] border-[#3498db] text-white" : "bg-[#1a1e29] border-transparent text-gray-400"
                  }`}
                >
                  {stream.title || `Server ${index + 1}`}
                </button>
              ))}
            </div>
          )}

          {currentMatch && (
            <div className="bg-[#1a1e29] border border-gray-800/80 rounded-xl p-5 mt-2 hidden lg:block">
              <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{currentMatch.eventInfo.eventName}</div>
              <div className="flex justify-center items-center gap-8">
                <div className="flex items-center gap-3">
                  <img src={getImg(currentMatch.eventInfo.teamAFlag)} className="w-8 h-8 rounded-full" loading="lazy" /> 
                  <span className="font-bold">{currentMatch.eventInfo.teamA}</span>
                </div>
                <span className="text-gray-600 font-black italic text-sm">VS</span>
                <div className="flex items-center gap-3">
                  <img src={getImg(currentMatch.eventInfo.teamBFlag)} className="w-8 h-8 rounded-full" loading="lazy" /> 
                  <span className="font-bold">{currentMatch.eventInfo.teamB}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (More Matches) */}
        <div className="mt-6 lg:mt-0 lg:col-span-1 h-[calc(100vh-150px)] overflow-y-auto scrollbar-hide pr-1">
          <div className="flex flex-col gap-3">
            {matches && matches.map((match: any) => {
              const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
              const isCurrent = match.id.toString() === id;

              return (
                <Link href={`/watch/${match.id}`} key={match.id} className="outline-none" prefetch={false}>
                  <div className={`bg-[#1a1e29] border rounded-xl p-4 ${isCurrent ? 'border-[#3498db] bg-[#1e2738]/50' : 'border-[#2d6a85]/30'}`}>
                    <div className="text-[12px] text-gray-400 mb-3 truncate">
                      {match.eventInfo.eventCat} | {match.eventInfo.eventName}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold truncate">{match.eventInfo.teamA}</span>
                      <span className="text-xs text-blue-400 font-bold uppercase">{status.label}</span>
                      <span className="text-xs font-semibold truncate text-right">{match.eventInfo.teamB}</span>
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
