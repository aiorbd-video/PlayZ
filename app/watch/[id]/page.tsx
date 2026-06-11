'use client';

import { useEffect, useRef, useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';

const CAT_API = "/api/proxy-cats";
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

  // Shaka Player Setup
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

  // Video Loading Logic
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
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-20">
      
      {/* 🔙 Back Nav */}
      <nav className="p-3 flex items-center bg-[#181a20]">
        <Link href="/">
          <button className="p-2 text-gray-300 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        </Link>
      </nav>

      {/* 📺 Player */}
      <div className="w-full max-w-3xl mx-auto bg-black aspect-video relative">
        {!streams && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="w-10 h-10 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <div ref={videoContainerRef} className="w-full h-full">
          <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-4">
        {/* 🎛️ Server Switcher (GHD Pill Style) */}
        {streams && streams.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 mb-4">
            {streams.map((stream: any, index: number) => (
              <button
                key={index}
                onClick={() => setActiveStreamIndex(index)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 border ${
                  activeStreamIndex === index
                    ? "bg-[#2a303f] border-[#3498db] text-white"
                    : "bg-[#2a303f] border-transparent text-gray-400"
                }`}
              >
                {activeStreamIndex === index && <svg className="w-4 h-4 text-[#3498db]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                {stream.title || `Server ${index + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* 🏟️ Other Matches List (Below Player) */}
        <div className="mt-6">
          {matches && matches.map((match: any) => {
            // সিম্পল টাইম রেন্ডারিং
            const startTime = new Date(match.eventInfo.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
            
            return (
              <Link href={`/watch/${match.id}`} key={match.id}>
                <div className={`bg-[#1a1e29] border border-[#2d6a85] rounded-xl p-4 mb-3 hover:bg-[#202533] transition-colors ${match.id.toString() === id ? 'ring-2 ring-[#3498db]' : ''}`}>
                  
                  <div className="text-center text-[13px] text-gray-300 font-medium mb-4 flex items-center justify-center gap-2">
                    <img src={getImg(match.eventInfo.eventLogo)} className="w-4 h-4 object-contain" alt="" />
                    {match.eventInfo.eventCat} | {match.eventInfo.eventName}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex flex-col items-center w-1/3">
                      <img src={getImg(match.eventInfo.teamAFlag)} alt={match.eventInfo.teamA} className="w-12 h-12 object-contain mb-2 rounded-full" />
                      <span className="text-sm font-medium text-gray-200 text-center">{match.eventInfo.teamA}</span>
                    </div>

                    <div className="flex flex-col items-center justify-center w-1/3 text-center">
                       <span className="text-gray-100 font-bold text-sm">
                         {startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>

                    <div className="flex flex-col items-center w-1/3">
                      <img src={getImg(match.eventInfo.teamBFlag)} alt={match.eventInfo.teamB} className="w-12 h-12 object-contain mb-2 rounded-full" />
                      <span className="text-sm font-medium text-gray-200 text-center">{match.eventInfo.teamB}</span>
                    </div>
                  </div>

                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </main>
  );
}
