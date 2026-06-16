'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';
import shaka from 'shaka-player/dist/shaka-player.ui';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export default function TvPlayer() {
  const params = useParams();
  const id = params.id as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<shaka.Player | null>(null);

  const { data, error } = useSWR('/api/channels', fetcher);
  const channel = data?.channels?.find((c: any) => c.id === id);

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
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
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

      <div className="max-w-5xl mx-auto px-2 sm:px-4 mt-6">
        {!data && !error && (
          <div className="w-full bg-black aspect-video rounded-xl flex items-center justify-center border border-gray-800">
             <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <div 
          ref={videoContainerRef} 
          className={`w-full bg-black aspect-video relative rounded-xl overflow-hidden shadow-xl border border-gray-800 shaka-video-container ${!channel ? 'hidden' : 'block'}`}
        >
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline />
        </div>
      </div>
    </main>
  );
}
