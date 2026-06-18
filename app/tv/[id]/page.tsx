'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import 'shaka-player/dist/controls.css';

import { fetcher } from '../../utils/helpers';
import { SmartImage } from '../../components/Cards';

export default function TvPlayer() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;

  const targetId = useMemo(() => {
    try {
      return decodeURIComponent(escape(atob(rawId)));
    } catch (e) {
      return rawId;
    }
  }, [rawId]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [searchInp, setSearchInp] = useState('');
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  
  // 🟢 নতুন: এরর এবং বাফারিং স্টেট
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  // কাস্টম প্রোটেকশন
  useEffect(() => {
    const blockInspect = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J'))) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', blockInspect);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockInspect);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  const { data } = useSWR('/api/channels', fetcher);
  const channels = data?.channels || [];
  const channel = channels.find((c: any) => c.id === targetId || c.id === rawId);

  // শাকা প্লেয়ার ও কাস্টম SVG Stretch বাটন সেটআপ
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || typeof window === 'undefined') return;

    const shaka = require('shaka-player/dist/shaka-player.ui');
    shaka.polyfill.installAll();

    let player = new shaka.Player(videoRef.current);
    let ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
    
    // 🟢 ফিক্সড: টেক্সটের বদলে প্রফেশনাল SVG আইকন ব্যবহার করা হয়েছে (ইউআই ফাটবে না)
    class StretchButton extends shaka.ui.Element {
        constructor(parent: HTMLElement, controls: any) {
            super(parent, controls);
            const button = document.createElement('button');
            button.className = 'shaka-stretch-button shaka-tooltip';
            button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
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
    } catch (e) {}

    ui.configure({
      controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'stretch', 'fullscreen'],
      addSeekBar: true,
    });

    // 🟢 ইভেন্ট লিসেনার: বাফারিং এবং এরর ধরার জন্য
    player.addEventListener('buffering', (e: any) => setIsBuffering(e.buffering));
    player.addEventListener('error', (e: any) => {
      console.error('Shaka Error:', e.detail);
      setPlayerError("Unable to play this channel. It might be offline or geo-blocked.");
      setIsBuffering(false);
    });

    setPlayerInstance(player);

    return () => {
      ui.destroy();
      player.destroy();
    };
  }, []);

  // ভিডিও এবং DRM লোড লজিক
  useEffect(() => {
    if (!playerInstance || !channel) return;
    const streamUrl = channel.link;
    const drmKeyString = channel.api;

    const loadVideo = async () => {
      setPlayerError(null);
      setIsBuffering(true);
      try {
        const playerConfig: any = {
          streaming: { bufferingGoal: 30, rebufferingGoal: 5, retryParameters: { maxAttempts: 3, baseDelay: 1000 } }
        };
        
        if (drmKeyString && drmKeyString.includes(':')) {
          const [kid, key] = drmKeyString.split(':');
          playerConfig.drm = { clearKeys: { [kid]: key } };
        }
        
        playerInstance.configure(playerConfig);

        let finalStreamUrl = streamUrl;
        if (window.location.protocol === 'https:' && finalStreamUrl.toLowerCase().startsWith('http://')) {
            finalStreamUrl = finalStreamUrl.replace(/^http:\/\//i, 'https://');
        }

        await playerInstance.load(finalStreamUrl);
        setIsBuffering(false);
      } catch (e) {
        console.error("Channel Load Error", e);
        setPlayerError("Failed to load stream. Please try another channel.");
        setIsBuffering(false);
      }
    };
    loadVideo();
  }, [playerInstance, channel]);

  const filteredChannels = useMemo(() => {
    return channels.filter((ch: any) => ch.name.toLowerCase().includes(searchInp.toLowerCase()));
  }, [channels, searchInp]);

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20 select-none">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-[#00E5FF] font-bold flex items-center gap-2 outline-none cursor-pointer hover:text-white transition-colors">
            <span>&larr;</span> Back
          </button>
          <span className="text-base font-bold text-[#00E5FF] flex items-center gap-2 truncate max-w-xs">
            {channel && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
            {channel?.name || "Loading..."}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        
        {/* 🟢 প্লেয়ার কন্টেইনার এবং এরর/লোডিং স্ক্রিন */}
        <div ref={videoContainerRef} className="w-full max-w-5xl mx-auto aspect-video relative bg-black shadow-2xl rounded-[20px] overflow-hidden shaka-video-container border border-gray-800/80 group">
          
          {/* বাফারিং লোডার */}
          {isBuffering && !playerError && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[#00E5FF] font-bold animate-pulse text-sm">Connecting...</p>
            </div>
          )}

          {/* এরর স্ক্রিন */}
          {playerError && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-bold text-white mb-2">Stream Error</h3>
              <p className="text-gray-400 text-sm max-w-md">{playerError}</p>
            </div>
          )}

          <video ref={videoRef} className="w-full h-full transition-all duration-300" style={{ objectFit: objectFit }} autoPlay playsInline />
          
          <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity z-30">
             {objectFit === 'contain' ? 'Fit Screen' : objectFit === 'cover' ? 'Zoom (Crop)' : 'Stretch'}
          </div>
        </div>

        {/* চ্যানেল গ্রিড */}
        <div className="max-w-7xl mx-auto mt-10 border-t border-gray-800/60 pt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xs md:text-sm font-black text-[#00E5FF] uppercase tracking-widest pl-1 flex items-center gap-2">
              <span className="text-red-500 animate-pulse">●</span> Sports Channels
            </h2>
            <input type="text" placeholder="Search sports channel..." value={searchInp} onChange={(e) => setSearchInp(e.target.value)} className="bg-[#1C1E2B] border border-gray-800 rounded-xl px-4 py-2 text-xs w-full sm:max-w-xs focus:outline-none focus:border-[#00E5FF] text-white shadow-inner" />
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredChannels.map((ch: any) => {
              const secureId = btoa(unescape(encodeURIComponent(ch.id)));

              return (
                <motion.div key={ch.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.95 }}>
                  {/* 🟢 ফিক্সড: Next.js <Link> ব্যবহার করা হয়েছে, এতে চ্যানেল পরিবর্তনের সময় পেজ ১০০% রিলোড/আপডেট হবে */}
                  <Link replace href={`/tv/${secureId}`} className="outline-none block w-full">
                    <div className={`bg-[#1C1E2B] border rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] h-full min-h-[140px] group ${ch.id === channel?.id ? 'border-[#00E5FF] ring-1 ring-[#00E5FF]/30' : 'border-gray-800/80'}`}>
                      
                      <div className="w-14 h-14 rounded-full bg-black/40 border border-gray-700/50 p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110 relative">
                        <SmartImage src={ch.logo} alt={ch.name} width={80} height={80} className="object-contain p-0.5" />
                      </div>
                      
                      {/* 🟢 ফিক্সড: Marquee (স্ক্রলিং টেক্সট) অ্যানিমেশন */}
                      <div className="w-full overflow-hidden whitespace-nowrap text-center marquee-container">
                        <span className={`inline-block font-bold text-xs md:text-sm text-gray-200 group-hover:text-white ${ch.name.length > 15 ? 'marquee-text' : ''}`}>
                          {ch.name}
                        </span>
                      </div>

                      {ch.id === channel?.id && <span className="text-[9px] px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded-full font-bold mt-auto">Playing</span>}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 🟢 কাস্টম CSS: শাকা বাটন এবং Marquee অ্যানিমেশনের জন্য */}
      <style dangerouslySetInnerHTML={{__html: `
        .shaka-stretch-button { 
           background: transparent; border: none; color: white; cursor: pointer; padding: 5px; opacity: 0.8; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .shaka-stretch-button:hover { opacity: 1; }
        
        .marquee-container {
           mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
           -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent);
        }
        .marquee-text {
           padding-left: 100%;
           animation: marquee 8s linear infinite;
        }
        @keyframes marquee {
           0% { transform: translateX(0); }
           100% { transform: translateX(-100%); }
        }
      `}} />
    </main>
  );
}
