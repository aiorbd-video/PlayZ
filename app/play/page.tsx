'use client';

import { useEffect, useRef, useState, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import 'shaka-player/dist/controls.css';

import { SmartImage } from '../components/Cards';

function PlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const streamUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Live TV';
  const playlistId = searchParams.get('playlistId');

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  
  const [playlistChannels, setPlaylistChannels] = useState<any[]>([]);
  const [searchInp, setSearchInp] = useState('');
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');

  // ১. শাকা প্লেয়ার এবং কাস্টম স্ট্রেচ বাটন সেটআপ
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || typeof window === 'undefined') return;

    const shaka = require('shaka-player/dist/shaka-player.ui');
    shaka.polyfill.installAll();

    let player = new shaka.Player(videoRef.current);
    let ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
    
    class StretchButton extends shaka.ui.Element {
        constructor(parent: HTMLElement, controls: any) {
            super(parent, controls);
            const button = document.createElement('button');
            button.className = 'shaka-stretch-button material-icons-round shaka-tooltip';
            button.innerHTML = 'aspect_ratio';
            button.setAttribute('aria-label', 'Toggle Fit');
            
            button.addEventListener('click', () => {
                setObjectFit(prev => prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain');
            });
            parent.appendChild(button);
        }
    }

    try {
        shaka.ui.Controls.registerElement('stretch', {
            create: (rootElement: HTMLElement, controls: any) => new StretchButton(rootElement, controls)
        });
    } catch (e) {
        console.log("Stretch button already registered, skipping safely.");
    }

    ui.configure({
      controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'stretch', 'fullscreen'],
      addSeekBar: true,
    });

    setPlayerInstance(player);

    return () => {
      ui.destroy();
      player.destroy();
    };
  }, []);

  // ২. ভিডিও স্ট্রিম লোড করা
  useEffect(() => {
    if (!playerInstance || !streamUrl) return;
    playerInstance.load(streamUrl).catch((e: any) => console.error("Stream Load Error", e));
  }, [playerInstance, streamUrl]);

  // ৩. ব্যাকগ্রাউন্ডে M3U প্লেলিস্টের বাকি চ্যানেল পার্স করা (এরর ফিক্সড এখানে)
  useEffect(() => {
    if (!playlistId) return;
    fetch('/api/m3u')
      .then(res => res.json())
      .then(data => {
        const playlistInfo = data?.channels?.find((c: any) => c.id === playlistId);
        if (playlistInfo && playlistInfo.link) {
          fetch(playlistInfo.link)
            .then(res => res.text())
            .then(text => {
              const lines = text.split('\n');
              const parsedChannels = [];
              let currentChannel: any = {};

              for (let line of lines) {
                line = line.trim();
                if (line.startsWith('#EXTINF')) {
                  const logoMatch = line.match(/tvg-logo="([^"]+)"/);
                  if (logoMatch) currentChannel.logo = logoMatch[1];
                  const nameSplit = line.split(',');
                  currentChannel.name = nameSplit[nameSplit.length - 1].trim();
                } else if (line.startsWith('http')) {
                  currentChannel.link = line;
                  if (currentChannel.name) parsedChannels.push(currentChannel);
                  currentChannel = {};
                }
              }
              setPlaylistChannels(parsedChannels);
            });
        }
      }).catch(err => console.error(err));
  }, [playlistId]);

  const filteredChannels = useMemo(() => {
    return playlistChannels.filter(ch => ch.name.toLowerCase().includes(searchInp.toLowerCase()));
  }, [playlistChannels, searchInp]);

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md flex items-center justify-between">
        <button onClick={() => router.back()} className="text-[#00E5FF] font-bold flex items-center gap-2 outline-none cursor-pointer">
          <span>&larr;</span> Back
        </button>
        <span className="font-bold truncate max-w-xs text-[#00E5FF]">{title}</span>
        <div className="w-10"></div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div ref={videoContainerRef} className="w-full max-w-5xl mx-auto aspect-video relative bg-black shadow-2xl rounded-[20px] overflow-hidden shaka-video-container border border-gray-800/80 group">
          {!streamUrl && <div className="absolute inset-0 flex items-center justify-center font-bold text-red-500">Invalid or Missing Stream URL</div>}
          <video ref={videoRef} className="w-full h-full transition-all duration-300" style={{ objectFit: objectFit }} autoPlay playsInline />
          <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
             {objectFit === 'contain' ? 'Fit Screen' : objectFit === 'cover' ? 'Zoom (Crop)' : 'Stretch'}
          </div>
        </div>

        {playlistChannels.length > 0 && (
          <div className="max-w-7xl mx-auto mt-10 border-t border-gray-800/60 pt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xs md:text-sm font-black text-[#00E5FF] uppercase tracking-widest pl-1 flex items-center gap-2">
                <span className="text-red-500 animate-pulse">●</span> Playlist Channels ({playlistChannels.length})
              </h2>
              <input type="text" placeholder="Quick search channel..." value={searchInp} onChange={(e) => setSearchInp(e.target.value)} className="bg-[#1C1E2B] border border-gray-800 rounded-xl px-4 py-2 text-xs w-full sm:max-w-xs focus:outline-none focus:border-[#00E5FF] text-white shadow-inner" />
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredChannels.map((ch, index) => (
                <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.95 }}>
                  <button onClick={() => router.replace(`/play?url=${encodeURIComponent(ch.link)}&title=${encodeURIComponent(ch.name)}&playlistId=${playlistId}`)} className="outline-none text-left w-full">
                    <div className={`bg-[#1C1E2B] border rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] h-full min-h-[140px] group ${ch.link === streamUrl ? 'border-[#00E5FF] ring-1 ring-[#00E5FF]/30' : 'border-gray-800/80'}`}>
                      <div className="w-14 h-14 rounded-full bg-black/40 border border-gray-700/50 p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110 relative">
                         <SmartImage src={ch.logo} alt={ch.name} fill className="object-contain p-0.5" />
                      </div>
                      <span className="font-bold text-xs md:text-sm text-gray-200 group-hover:text-white text-center truncate w-full">{ch.name}</span>
                      {ch.link === streamUrl && <span className="text-[9px] px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded-full font-bold">Playing</span>}
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .shaka-stretch-button {
           background: transparent; border: none; color: white; font-size: 20px;
           cursor: pointer; padding: 5px; opacity: 0.8; transition: opacity 0.2s;
        }
        .shaka-stretch-button:hover { opacity: 1; }
      `}} />
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#11131A] flex flex-col items-center justify-center text-[#00E5FF]">
         <div className="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-4"></div>
         <p className="animate-pulse font-bold">Loading Player...</p>
      </div>
    }>
      <PlayerContent />
    </Suspense>
  );
}
