'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import 'shaka-player/dist/controls.css';

import { fetcher } from '../../utils/helpers';
import { SmartImage } from '../../components/Cards';

export default function TvPlayer() {
  const params = useParams();
  const id = params.id as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  
  const [searchInp, setSearchInp] = useState('');
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');

  const { data } = useSWR('/api/channels', fetcher);
  const channels = data?.channels || [];
  const channel = channels.find((c: any) => c.id === id);

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

    if (!shaka.ui.Controls.panels.bottom.customButtons) {
        shaka.ui.Controls.registerElement('stretch', {
            create: (rootElement: HTMLElement, controls: any) => new StretchButton(rootElement, controls)
        });
        shaka.ui.Controls.panels.bottom.customButtons = true;
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

  useEffect(() => {
    if (!playerInstance || !channel) return;
    const streamUrl = channel.link;
    const drmKeyString = channel.api;

    const loadVideo = async () => {
      try {
        const playerConfig: any = {
          streaming: { bufferingGoal: 30, rebufferingGoal: 5, retryParameters: { maxAttempts: 5, baseDelay: 1000 } }
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

  const filteredChannels = useMemo(() => {
    return channels.filter((ch: any) => ch.name.toLowerCase().includes(searchInp.toLowerCase()));
  }, [channels, searchInp]);

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="outline-none">
            <button className="text-[#00E5FF] font-bold flex items-center gap-2 outline-none">
              <span>&larr;</span> Back
            </button>
          </Link>
          <span className="text-base font-bold text-[#00E5FF] flex items-center gap-2 truncate max-w-xs">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {channel?.name || "Live TV"}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div ref={videoContainerRef} className="w-full max-w-5xl mx-auto aspect-video relative bg-black shadow-2xl rounded-[20px] overflow-hidden shaka-video-container border border-gray-800/80 group">
          <video ref={videoRef} className="w-full h-full transition-all duration-300" style={{ objectFit: objectFit }} autoPlay playsInline />
          <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">
             {objectFit === 'contain' ? 'Fit Screen' : objectFit === 'cover' ? 'Zoom (Crop)' : 'Stretch'}
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-10 border-t border-gray-800/60 pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xs md:text-sm font-black text-[#00E5FF] uppercase tracking-widest pl-1 flex items-center gap-2">
              <span className="text-red-500 animate-pulse">●</span> Sports Channels
            </h2>
            <input type="text" placeholder="Search sports channel..." value={searchInp} onChange={(e) => setSearchInp(e.target.value)} className="bg-[#1C1E2B] border border-gray-800 rounded-xl px-4 py-2 text-xs w-full sm:max-w-xs focus:outline-none focus:border-[#00E5FF] text-white shadow-inner" />
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredChannels.map((ch: any) => (
              <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.95 }}>
                {/* 🟢 এখানে replace যোগ করা হয়েছে */}
                <Link replace href={`/tv/${ch.id}`} className="outline-none block">
                  <div className={`bg-[#1C1E2B] border rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] h-full min-h-[140px] group ${ch.id === id ? 'border-[#00E5FF] ring-1 ring-[#00E5FF]/30' : 'border-gray-800/80'}`}>
                    <div className="w-14 h-14 rounded-full bg-black/40 border border-gray-700/50 p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110 relative">
                      <SmartImage src={ch.logo} alt={ch.name} fill className="object-contain p-0.5" />
                    </div>
                    <span className="font-bold text-xs md:text-sm text-gray-200 group-hover:text-white text-center truncate w-full">{ch.name}</span>
                    {ch.id === id && <span className="text-[9px] px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded-full font-bold">Playing</span>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
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
