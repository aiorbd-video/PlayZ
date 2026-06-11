'use client';

import { useEffect, useRef, useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  // Promise হিসেবে আসা params কে use() দিয়ে আনপ্যাক করা
  const { id } = use(params);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);

  // ১. ম্যাচের ডিটেইলস টানা (আমাদের বানানো প্রক্সি লিংক থেকে)
  const { data: matches } = useSWR('/api/proxy-matches', fetcher);
  const matchDetails = matches?.find((m: any) => m.id.toString() === id);

  // ২. ফায়ারবেস থেকে লাইভ ভিডিও লিংক ও DRM চাবি টানা (প্রতি ৫ সেকেন্ডে রিফ্রেশ)
  const FIREBASE_URL = process.env.NEXT_PUBLIC_FIREBASE_URL || "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  const { data: streams } = useSWR(`${FIREBASE_URL}/live-stream.json`, fetcher, { refreshInterval: 5000 });

  const imgProxy = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";
  const getImg = (url: string) => (url && url !== "null" ? `${imgProxy}${url}` : "");

  // ⚙️ Shaka Player ইনিশিয়ালাইজ করা
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;

    let player: any;
    let ui: any;

    // Server-Side Rendering এরর এড়াতে Dynamic Import
    import('shaka-player/dist/shaka-player.ui.js').then((shaka) => {
      shaka.polyfill.installAll();

      if (shaka.Player.isBrowserSupported()) {
        player = new shaka.Player(videoRef.current);
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        
        // প্লেয়ারের UI কাস্টমাইজেশন (Premium Look)
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen', 'overflow_menu'],
          addSeekBar: true,
        });

        setPlayerInstance(player);
      } else {
        console.error('আপনার ব্রাউজারটি ভিডিও প্লেয়ার সাপোর্ট করছে না!');
      }
    });

    return () => {
      if (player) player.destroy();
      if (ui) ui.destroy();
    };
  }, []);

  // 🚀 স্ট্রিম ডেটা পেলে ভিডিও লোড ও DRM আনলক করা
  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0) return;

    // টার্মাক্স থেকে আসা লেটেস্ট লিংক
    const currentStream = streams[0];
    const streamUrl = currentStream.link;
    const drmKeyString = currentStream.api; // ফরম্যাট: "KID:KEY"

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
        console.error('ভিডিও লোড হতে সমস্যা হচ্ছে:', e);
      }
    };

    loadVideo();
  }, [playerInstance, streams]);

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white pb-20">
      
      {/* 🔙 Top Navigation */}
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
        {/* 📺 Video Player Section */}
        <div className="w-full bg-black aspect-video relative shadow-2xl shadow-red-900/10">
          {!streams ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
              <div className="w-12 h-12 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 font-medium animate-pulse">খেলার লাইভ সার্ভার খোঁজা হচ্ছে...</p>
            </div>
          ) : null}

          {/* Shaka Player Container */}
          <div ref={videoContainerRef} className="w-full h-full">
            <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
          </div>
        </div>

        {/* 📊 Match Info Section */}
        {matchDetails && (
          <div className="p-4 md:p-8">
            <div className="bg-[#151C2C] border border-gray-800 rounded-2xl p-6 md:p-8">
              
              {/* Event Badge */}
              <div className="flex justify-center mb-6">
                <span className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  {matchDetails.eventInfo.eventName}
                </span>
              </div>

              {/* Teams Display */}
              <div className="flex justify-center items-center gap-6 md:gap-16">
                {/* Team A */}
                <div className="flex flex-col items-center w-32">
                  <img src={getImg(matchDetails.eventInfo.teamAFlag)} alt={matchDetails.eventInfo.teamA} className="w-20 h-20 md:w-24 md:h-24 object-contain mb-3 drop-shadow-lg" />
                  <span className="text-base md:text-xl font-bold text-center">{matchDetails.eventInfo.teamA}</span>
                </div>

                {/* VS */}
                <div className="text-xl md:text-3xl font-black italic text-gray-700">VS</div>

                {/* Team B */}
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
