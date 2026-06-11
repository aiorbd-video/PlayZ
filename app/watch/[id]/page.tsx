'use client';

import { useEffect, useRef, useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  
  // 🟢 নতুন: কোন সার্ভারটি এখন প্লে হবে তার ট্র্যাক রাখা (ডিফল্ট 0 মানে প্রথমটা)
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);

  const { data: matches } = useSWR('/api/proxy-matches', fetcher);
  const matchDetails = matches?.find((m: any) => m.id.toString() === id);

  const FIREBASE_URL = process.env.NEXT_PUBLIC_FIREBASE_URL || "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  const { data: streams } = useSWR(`${FIREBASE_URL}/live-stream.json`, fetcher, { refreshInterval: 5000 });

  const imgProxy = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";
  const getImg = (url: string) => (url && url !== "null" ? `${imgProxy}${url}` : "");

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

  // 🚀 যখনই activeStreamIndex বা streams চেঞ্জ হবে, নতুন ভিডিও লোড হবে
  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0) return;

    // ইউজারের সিলেক্ট করা লিংকটি নেওয়া হলো
    const currentStream = streams[activeStreamIndex] || streams[0];
    const streamUrl = currentStream.link;
    const drmKeyString = currentStream.api;

    const loadVideo = async () => {
      try {
        if (drmKeyString && drmKeyString.includes(':')) {
          const [kid, key] = drmKeyString.split(':');
          playerInstance.configure({
            drm: { clearKeys: { [kid]: key } }
          });
        } else {
          playerInstance.configure({ drm: { clearKeys: {} } });
        }

        await playerInstance.load(streamUrl);
      } catch (e) {
        console.error('ভিডিও লোড হতে সমস্যা:', e);
      }
    };

    loadVideo();
  }, [playerInstance, streams, activeStreamIndex]); // activeStreamIndex ডিপেন্ডেন্সিতে অ্যাড করা হয়েছে

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white pb-20">
      
      <nav className="p-4 flex items-center gap-4 bg-[#0B0F19] border-b border-gray-800 sticky top-0 z-50">
        <Link href="/">
          <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </Link>
        <h1 className="text-lg font-bold text-gray-200">
          {matchDetails ? matchDetails.title : "Live Stream"}
        </h1>
      </nav>

      <div className="max-w-5xl mx-auto w-full">
        <div className="w-full bg-black aspect-video relative shadow-2xl shadow-red-900/10">
          {!streams ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
              <div className="w-12 h-12 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 font-medium animate-pulse">খেলার লাইভ সার্ভার খোঁজা হচ্ছে...</p>
            </div>
          ) : null}

          <div ref={videoContainerRef} className="w-full h-full">
            <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
          </div>
        </div>

        {/* 🎛️ Server Switcher Buttons (নতুন যুক্ত করা হয়েছে) */}
        {streams && streams.length > 1 && (
          <div className="bg-[#0F1523] p-4 border-b border-gray-800 flex gap-3 overflow-x-auto scrollbar-hide">
            <span className="text-gray-400 font-bold flex items-center whitespace-nowrap">Servers:</span>
            {streams.map((stream: any, index: number) => (
              <button
                key={index}
                onClick={() => setActiveStreamIndex(index)}
                className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  activeStreamIndex === index
                    ? "bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
                }`}
              >
                {stream.title || `Server ${index + 1}`}
              </button>
            ))}
          </div>
        )}

        {matchDetails && (
          <div className="p-4 md:p-8">
            <div className="bg-[#151C2C] border border-gray-800 rounded-2xl p-6 md:p-8">
              
              <div className="flex justify-center mb-6">
                <span className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  {matchDetails.eventInfo.eventName}
                </span>
              </div>

              <div className="flex justify-center items-center gap-6 md:gap-16">
                <div className="flex flex-col items-center w-32">
                  <img src={getImg(matchDetails.eventInfo.teamAFlag)} alt={matchDetails.eventInfo.teamA} className="w-20 h-20 md:w-24 md:h-24 object-contain mb-3 drop-shadow-lg" />
                  <span className="text-base md:text-xl font-bold text-center">{matchDetails.eventInfo.teamA}</span>
                </div>

                <div className="text-xl md:text-3xl font-black italic text-gray-700">VS</div>

                <div className="flex flex-col items-center w-32">
                  <img src={getImg(matchDetails.eventInfo.teamBFlag)} alt={matchDetails.eventInfo.teamB} className="w-20 h-20 md:w-24 md:h-24 object-contain mb-3 drop-shadow-lg" />
                  <span className="text-base md:text-xl font-bold text-center">{matchDetails.eventInfo.teamB}</span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
      
    </main>
  );
}
