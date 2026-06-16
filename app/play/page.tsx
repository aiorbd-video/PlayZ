'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';
import shaka from 'shaka-player/dist/shaka-player.ui';

function PlayerContent() {
  const searchParams = useSearchParams();
  const streamUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Live TV';

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<shaka.Player | null>(null);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;
    shaka.polyfill.installAll();
    
    let player = new shaka.Player(videoRef.current);
    let ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
    
    ui.configure({
      controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen'],
    });

    setPlayerInstance(player);

    return () => {
      ui.destroy();
      player.destroy();
    };
  }, []);

  useEffect(() => {
    if (!playerInstance || !streamUrl) return;
    playerInstance.load(streamUrl).catch(e => console.error("Stream Load Error", e));
  }, [playerInstance, streamUrl]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <nav className="p-4 bg-[#11131A]/90 absolute top-0 w-full z-50 border-b border-gray-800/60 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity">
        <Link href="#" onClick={() => window.history.back()}>
          <button className="text-[#00E5FF] font-bold flex items-center gap-2">
            <span>&larr;</span> Back
          </button>
        </Link>
        <span className="font-bold truncate max-w-xs">{title}</span>
        <div className="w-10"></div>
      </nav>

      <div className="flex-grow flex items-center justify-center p-0 md:p-8">
        <div ref={videoContainerRef} className="w-full max-w-5xl aspect-video relative bg-black shadow-2xl md:rounded-xl overflow-hidden shaka-video-container border border-gray-800">
          {!streamUrl && <div className="absolute inset-0 flex items-center justify-center">Invalid Stream URL</div>}
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline />
        </div>
      </div>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-[#00E5FF]">Loading Player...</div>}>
      <PlayerContent />
    </Suspense>
  );
}
