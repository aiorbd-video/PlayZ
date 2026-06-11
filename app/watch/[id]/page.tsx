'use client';

import { useEffect, useRef, useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const getImg = (url: string) => (url && url !== "null" ? `${IMG_PROXY}${url}` : "");

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);

  const { data: matches } = useSWR(MATCH_API, fetcher);
  
  const FIREBASE_URL = process.env.NEXT_PUBLIC_FIREBASE_URL || "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  const { data: streams } = useSWR(`${FIREBASE_URL}/live-stream.json`, fetcher, { refreshInterval: 5000 });

  const currentMatch = matches?.find((m: any) => m.id.toString() === id);

  // Shaka Player Init
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
        
        // টিভিতে রিমোট দিয়ে কন্ট্রোল করার জন্য স্ট্যান্ডার্ড কন্ট্রোলস
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

  // Streaming Link Loader
  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0) return;
    const currentStream = streams[activeStreamIndex] || streams[0];
    const streamUrl = currentStream.link;
    const drmKeyString = currentStream.api;

    const loadVideo = async () => {
      try {
        if (drmKeyString && drmKeyString.includes(':')) {
          const [kid, key] = drmKeyString.split(':');
          playerInstance.configure({ drm: { clearKeys: { [kid]: key } } });
        } else {
          playerInstance.configure({ drm: { clearKeys: {} } });
        }
        await playerInstance.load(streamUrl);
      } catch (e) {
        console.error('Video Error:', e);
      }
    };
    loadVideo();
  }, [playerInstance, streams, activeStreamIndex]);

  return (
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-10">
      
      {/* 🔙 Top Back Nav */}
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
          <span className="text-sm md:text-base font-bold text-gray-300 truncate max-w-xs sm:max-w-md">
            {currentMatch ? currentMatch.title : "Live Streaming"}
          </span>
          <div className="w-10"></div> {/* Spacer */}
        </div>
      </nav>

      {/* 🖥️ 📱 Responsive Layout Container */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 mt-4 lg:grid lg:grid-cols-3 lg:gap-6">
        
        {/* 🎬 LEFT COLUMN: Player & Servers (Takes 2 columns on Big Screens) */}
        <div className="lg:col-span-2 flex flex-col">
          
          {/* 📺 Theatre View Video Container */}
          <div className="w-full bg-black aspect-video relative rounded-none sm:rounded-xl overflow-hidden shadow-xl border border-gray-800">
            {!streams && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#12141c]/90 z-10">
                <div className="w-10 h-10 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <div ref={videoContainerRef} className="w-full h-full">
              <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
            </div>
          </div>

          {/* 🎛️ Server Switcher Pills */}
          {streams && streams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-3 my-2 border-b border-gray-800/50">
              <span className="text-gray-400 font-bold flex items-center text-sm mr-2 whitespace-nowrap">Servers:</span>
              {streams.map((stream: any, index: number) => (
                <button
                  key={index}
                  onClick={() => setActiveStreamIndex(index)}
                  className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 border outline-none focus:ring-2 focus:ring-[#3498db] ${
                    activeStreamIndex === index
                      ? "bg-[#1e2738] border-[#3498db] text-white shadow-md shadow-[#3498db]/10"
                      : "bg-[#1a1e29] border-transparent text-gray-400 hover:text-white"
                  }`}
                >
                  {activeStreamIndex === index && <span className="w-1.5 h-1.5 bg-[#3498db] rounded-full animate-ping"></span>}
                  {stream.title || `Server ${index + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Current Match Live Info */}
          {currentMatch && (
            <div className="bg-[#1a1e29] border border-gray-800/80 rounded-xl p-5 mt-2 hidden lg:block">
              <div className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{currentMatch.eventInfo.eventName}</div>
              <div className="flex justify-center items-center gap-8">
                <div className="flex items-center gap-3"><img src={getImg(currentMatch.eventInfo.teamAFlag)} className="w-8 h-8 rounded-full" /> <span className="font-bold">{currentMatch.eventInfo.teamA}</span></div>
                <span className="text-gray-600 font-black italic text-sm">VS</span>
                <div className="flex items-center gap-3"><img src={getImg(currentMatch.eventInfo.teamBFlag)} className="w-8 h-8 rounded-full" /> <span className="font-bold">{currentMatch.eventInfo.teamB}</span></div>
              </div>
            </div>
          )}

        </div>

        {/* 🏟️ RIGHT COLUMN: Playlist / Other Matches (1 column on Big Screens) */}
        <div className="mt-6 lg:mt-0 lg:col-span-1 h-[calc(100vh-150px)] overflow-y-auto scrollbar-hide pr-1">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1 hidden lg:block">More Matches</h2>
          
          <div className="flex flex-col gap-3">
            {matches && matches.map((match: any) => {
              const startTime = new Date(match.eventInfo.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
              const isCurrent = match.id.toString() === id;

              return (
                <Link href={`/watch/${match.id}`} key={match.id} className="outline-none">
                  <div className={`bg-[#1a1e29] border rounded-xl p-4 transition-all hover:bg-[#202533] ${
                    isCurrent ? 'border-[#3498db] bg-[#1e2738]/50 shadow-md shadow-[#3498db]/5' : 'border-[#2d6a85]/30'
                  }`}>
                    
                    <div className="text-[12px] text-gray-400 font-medium mb-3 flex items-center gap-2 truncate">
                      <img src={getImg(match.eventInfo.eventLogo)} className="w-3.5 h-3.5 object-contain rounded-full" alt="" />
                      <span className="truncate">{match.eventInfo.eventCat} | {match.eventInfo.eventName}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 w-[40%]">
                        <img src={getImg(match.eventInfo.teamAFlag)} className="w-7 h-7 object-contain rounded-full" />
                        <span className="text-xs font-semibold text-gray-200 truncate">{match.eventInfo.teamA}</span>
                      </div>

                      <div className="w-[20%] text-center">
                         <span className="text-[#3498db] font-bold text-[11px] bg-[#3498db]/10 px-1.5 py-0.5 rounded">
                           {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                         </span>
                      </div>

                      <div className="flex items-center gap-2 w-[40%] justify-end">
                        <span className="text-xs font-semibold text-gray-200 truncate text-right">{match.eventInfo.teamB}</span>
                        <img src={getImg(match.eventInfo.teamBFlag)} className="w-7 h-7 object-contain rounded-full" />
                      </div>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </main>
  );
}
