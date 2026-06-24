// app/play/page.tsx
'use client';

import { useEffect, useRef, useState, Suspense, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

import { SmartImage } from '../components/Cards';
// 🎯 আপনার স্মার্ট ইঞ্জিন ইমপোর্ট করা হলো
import { StreamBrain, NetworkAI, ServerRanker } from '../media/PlayzEngine';

function PlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const streamToken = searchParams.get('stream');
  const drmKeyString = searchParams.get('key'); 
  const title = searchParams.get('title') || 'Live TV';
  const playlistId = searchParams.get('playlistId');

  const streamUrl = useMemo(() => {
    if (!streamToken) return null;
    try {
      return decodeURIComponent(escape(atob(streamToken)));
    } catch (e) {
      return null;
    }
  }, [streamToken]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const coreWatchdogRef = useRef<any>(null); // 🎯 ওয়াচডগ রেফারেন্স
  
  // Enterprise Core Stability Refs
  const playerInitRef = useRef(false);
  const lastAppliedDrmRef = useRef<string | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>>(new Set());

  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [playlistChannels, setPlaylistChannels] = useState<any[]>([]);
  const [searchInp, setSearchInp] = useState('');
  
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  // Core Client Security Layers
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

  const handleFitToggle = useCallback(() => {
    setObjectFit((prev) => {
      const nextFit = prev === 'contain' ? 'cover' : prev === 'cover' ? 'fill' : 'contain';
      setShowFitToast(true);
      return nextFit;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('toggleObjectFit', handleFitToggle);
    return () => window.removeEventListener('toggleObjectFit', handleFitToggle);
  }, [handleFitToggle]);

  useEffect(() => {
    if (showFitToast) {
      const timer = setTimeout(() => setShowFitToast(false), 2000);
      timersRef.current.add(timer);
      return () => {
        clearTimeout(timer);
        timersRef.current.delete(timer);
      };
    }
  }, [showFitToast, objectFit]);

  // ==========================================
  // PLAYER INITIALIZATION & UI EVENTS
  // ==========================================
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || typeof window === 'undefined') return;

    if (playerInitRef.current) return;
    playerInitRef.current = true;

    let shaka: any;
    let player: any;
    let ui: any;
    let isCancelled = false;

    const initPlayer = async () => {
      try {
        shaka = await import('shaka-player/dist/shaka-player.ui');
        if (isCancelled) return;
        shaka.polyfill.installAll();

        try {
          if (shaka.ui.Controls && !(shaka.ui.Controls as any).custom_stretch_registered) {
            class StretchButton extends shaka.ui.Element {
              constructor(parent: HTMLElement, controls: any) {
                super(parent, controls);
                const button = document.createElement('button');
                button.className = 'shaka-custom-stretch-btn shaka-tooltip';
                button.setAttribute('aria-label', 'Toggle Fit');
                button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="white" style="pointer-events:none;"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
                
                this.eventManager.listen(button, 'click', () => {
                  window.dispatchEvent(new CustomEvent('toggleObjectFit'));
                });
                parent.appendChild(button);
              }
            }
            shaka.ui.Controls.registerElement('custom_stretch', {
              create: (rootElement: HTMLElement, controls: any) => new StretchButton(rootElement, controls)
            });
            (shaka.ui.Controls as any).custom_stretch_registered = true;
          }
        } catch (e) {}

        player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'overflow_menu', 'fullscreen'],
          addSeekBar: true,
          trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat.RESOLUTION_BITRATE
        });

        player.configure({
          streaming: {
            bufferingGoal: 30,
            rebufferingGoal: 5,
            bufferBehind: 15,
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2, timeout: 20000 }
          },
          abr: { 
            enabled: true, 
            defaultBandwidthEstimate: 2000000,
            restrictions: { maxHeight: 4320, maxWidth: 7680 } 
          },
          manifest: { dash: { ignoreMinBufferTime: true } }
        });

        player.addEventListener('buffering', (e: any) => setIsBuffering(e.buffering));
        player.addEventListener('error', (e: any) => {
          console.error("Shaka Internal Error:", e.detail);
          setPlayerError("Unable to play this channel. It might be offline or blocked.");
          setIsBuffering(false);
        });

        setPlayerInstance(player);
      } catch (err) {
        setPlayerError("Player initialization failed.");
        playerInitRef.current = false;
      }
    };

    initPlayer();

    return () => {
      isCancelled = true;
      playerInitRef.current = false;
      if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);
      if (ui) ui.destroy();
      if (player) {
        try { player.unload(); } catch {}
        player.destroy();
      }
      timersRef.current.forEach(clearTimeout);
      timersRef.current.forEach(clearInterval);
      timersRef.current.clear();
    };
  }, []);

  // ==========================================
  // STREAM LOAD & SMART ENGINE INTEGRATION
  // ==========================================
  useEffect(() => {
    if (!playerRef.current || !streamUrl) return;

    let isMounted = true;
    
    // 🎯 ডেড স্ট্রিম হ্যান্ডেলার (আটকে গেলে অটো রিলোড করবে)
    const handleDeadStream = async () => {
      if (!isMounted || !playerRef.current) return;
      console.warn("Engine: Dead stream detected, attempting force recovery...");
      setIsBuffering(true);
      try {
        await playerRef.current.unload();
        await playerRef.current.load(streamUrl);
        videoRef.current?.play().catch(()=>{});
        setIsBuffering(false);
      } catch (e) {
        setPlayerError("Stream connection lost.");
      }
    };

    const loadVideo = async () => {
      setPlayerError(null);
      setIsBuffering(true);
      if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);

      try {
        if (lastAppliedDrmRef.current !== drmKeyString) {
          const clearKeysObj: Record<string, string> = {};
          let parsedData: any = drmKeyString;

          if (typeof drmKeyString === 'string') {
            const trimmed = drmKeyString.trim();
            if (trimmed.startsWith('{')) {
              try { parsedData = JSON.parse(trimmed); } catch (e) {}
            }
          }

          if (typeof parsedData === 'object' && parsedData !== null) {
            Object.entries(parsedData).forEach(([k, v]) => {
              const cleanKid = k.replace(/['"\s{}:]/g, '');
              const cleanKey = String(v).replace(/['"\s{}:]/g, '');
              if (cleanKid && cleanKey) clearKeysObj[cleanKid] = cleanKey;
            });
          } else if (typeof parsedData === 'string' && parsedData.includes(':')) {
            const cleanStr = parsedData.replace(/['"\s{}]/g, '');
            const parts = cleanStr.split(':');
            if (parts.length === 2) clearKeysObj[parts[0]] = parts[1];
          }

          if (Object.keys(clearKeysObj).length > 0) {
            playerRef.current.configure({ drm: { clearKeys: clearKeysObj } });
          } else {
            playerRef.current.configure({ drm: { clearKeys: {} } });
          }
          lastAppliedDrmRef.current = drmKeyString;
        }

        let finalStreamUrl = streamUrl;
        if (window.location.protocol === 'https:' && finalStreamUrl.toLowerCase().startsWith('http://')) {
            finalStreamUrl = finalStreamUrl.replace(/^http:\/\//i, 'https://');
        }

        await playerRef.current.unload();
        await playerRef.current.load(finalStreamUrl);
        if (isMounted) setIsBuffering(false);

        // 🎯 ব্রেইন রিসেট এবং ওয়াচডগ চালু
        StreamBrain.reset();
        coreWatchdogRef.current = setInterval(() => {
          const video = videoRef.current;
          const player = playerRef.current;
          if (!video || !player) return;

          let stats: any = {};
          try {
            if (typeof player.getStats === 'function') stats = player.getStats() || {};
          } catch {}

          const bandwidth = stats.estimatedBandwidth || 4000000;
          NetworkAI.push(bandwidth);

          // ইঞ্জিনকে আপডেট দেওয়া হচ্ছে
          StreamBrain.update({
            video,
            safeSwitch: handleDeadStream, // ডেড হলে রিকভারি ট্রিগার করবে
          });
        }, 1000);

      } catch (e) {
        console.error("Load Error", e);
        if (isMounted) {
          setPlayerError("Failed to load stream. Please try another channel.");
          setIsBuffering(false);
        }
      }
    };

    loadVideo();
    return () => {
      isMounted = false;
      if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);
    };
  }, [playerRef.current, streamUrl, drmKeyString]);

  // Playlist Parsing Management
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
                } else if (line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
                  currentChannel.key = line.split('=')[1].trim();
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
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20 select-none">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md flex items-center justify-between">
        <button onClick={() => router.back()} className="text-[#00E5FF] font-bold flex items-center gap-2 outline-none cursor-pointer hover:text-white transition-colors">
          <span>&larr;</span> Back
        </button>
        <span className="font-bold truncate max-w-xs text-[#00E5FF]">{title}</span>
        <div className="w-10"></div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div ref={videoContainerRef} className="w-full max-w-5xl mx-auto aspect-video relative bg-black shadow-2xl rounded-[20px] overflow-hidden shaka-video-container border border-gray-800/80 group">
          
          {isBuffering && !playerError && streamUrl && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-[#00E5FF] font-bold animate-pulse text-sm">Connecting...</p>
            </div>
          )}

          {playerError && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-bold text-white mb-2">Stream Error</h3>
              <p className="text-gray-400 text-sm max-w-md">{playerError}</p>
            </div>
          )}

          {!streamUrl && <div className="absolute inset-0 flex items-center justify-center font-bold text-red-500 z-50 bg-black">Invalid or Missing Stream URL</div>}
          
          <video ref={videoRef} className="w-full h-full transition-all duration-300" style={{ objectFit: objectFit }} autoPlay playsInline />
          
          <AnimatePresence>
            {showFitToast && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-6 left-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700/50 shadow-xl z-50 flex items-center gap-2 pointer-events-none"
              >
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></span>
                <span className="text-xs md:text-sm font-bold text-white capitalize">
                  {objectFit === 'contain' ? 'Fit to Screen' : objectFit === 'cover' ? 'Zoom (Cropped)' : 'Stretch (Fill)'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
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
              {filteredChannels.map((ch, index) => {
                const secureToken = btoa(unescape(encodeURIComponent(ch.link)));
                const drmKeyParam = ch.key ? `&key=${encodeURIComponent(ch.key)}` : '';
                
                return (
                  <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.95 }}>
                    <Link replace prefetch={false} href={`/play?stream=${secureToken}${drmKeyParam}&title=${encodeURIComponent(ch.name)}&playlistId=${playlistId}`} className="outline-none block w-full">
                      <div className={`bg-[#1C1E2B] border rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] h-full min-h-[140px] group ${ch.link === streamUrl ? 'border-[#00E5FF] ring-1 ring-[#00E5FF]/30' : 'border-gray-800/80'}`}>
                        
                        <div className="w-14 h-14 rounded-full bg-black/40 border border-gray-700/50 p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110 relative">
                           <SmartImage src={ch.logo} alt={ch.name} width={80} height={80} className="object-contain p-0.5" />
                        </div>
                        
                        <div className="w-full overflow-hidden whitespace-nowrap text-center marquee-container">
                          <span className={`inline-block font-bold text-xs md:text-sm text-gray-200 group-hover:text-white ${ch.name.length > 15 ? 'marquee-text' : ''}`}>
                            {ch.name}
                          </span>
                        </div>

                        {ch.link === streamUrl && <span className="text-[9px] px-2 py-0.5 bg-[#00E5FF]/20 text-[#00E5FF] rounded-full font-bold mt-auto">Playing</span>}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .shaka-custom-stretch-btn { background: transparent; border: none; color: white; cursor: pointer; padding: 5px; opacity: 0.8; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; }
        .shaka-custom-stretch-btn:hover { opacity: 1; }
        .marquee-container { mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
        .marquee-text { padding-left: 100%; animation: marquee 8s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
      `}} />
      <Script 
        src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js"
        strategy="lazyOnload" 
        id="adsterra-popunder"
      />
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
