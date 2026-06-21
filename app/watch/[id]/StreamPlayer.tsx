'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

interface Stream {
  link_names: string[];
  links: string;
}

interface EventInfo {
  eventCat: string;
  eventName: string;
  teamA: string;
  teamB: string;
  teamAFlag: string;
  teamBFlag: string;
  startTime: string;
  endTime: string;
}

interface Match {
  id: number | string;
  eventInfo: EventInfo;
  links?: string;
}

const LIVE_EVENTS_API = process.env.NEXT_PUBLIC_LIVE_EVENTS_API || "https://ratulxadia-playz-cats-event.hf.space/api/events";
const STREAM_API_BASE = process.env.NEXT_PUBLIC_STREAM_API_BASE || "https://ratulxadia-playz-cats-event.hf.space/api/stream/";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined | null) => {
  if (!url || url === "null") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const generateSlug = (teamA?: string, teamB?: string, eventName?: string, id?: string | number) => {
  const tA = teamA || 'team';
  const tB = teamB || 'match';
  const event = eventName || 'live-event';
  const rawString = `${tA}-vs-${tB}-${event}`;
  const cleanSlug = rawString.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${cleanSlug}-${id || '0'}`;
};

const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return { type: "upcoming", label: "TBA" };
  const startTime = new Date(startStr);
  let endTime = new Date(endStr);
  if (startTime.getTime() === endTime.getTime()) {
    endTime = new Date(startTime.getTime() + (4 * 60 * 60 * 1000));
  }
  if (currentTime > endTime) return { type: "ended", label: "Ended" };
  else if (currentTime >= startTime && currentTime <= endTime) return { type: "live", label: "LIVE" };
  else return { type: "upcoming", label: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
};

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamsRef = useRef<any[] | null>(null);
  const activeIndexRef = useRef<number>(0);

  const { data: rawMatches } = useSWR(LIVE_EVENTS_API ? LIVE_EVENTS_API : null, fetcher, { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false });

  const matches = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;
    return rawMatches.map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const convertDate = (dStr: string, tStr: string) => {
        if (!dStr || !tStr) return "";
        const parts = dStr.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}T${tStr}Z`;
        return `${dStr}T${tStr}Z`;
      };
      const startTime = convertDate(rawEvent.date, rawEvent.time);
      const endTime = convertDate(rawEvent.end_date || rawEvent.date, rawEvent.end_time || rawEvent.time);
      const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : index.toString();
      return {
        id: matchId,
        links: rawEvent.links || "",
        eventInfo: {
          eventCat: rawEvent.category || "Live Event",
          eventName: rawEvent.eventName || "Live Match",
          teamA: rawEvent.teamAName || "Team A",
          teamB: rawEvent.teamBName || "Team B",
          teamAFlag: rawEvent.teamAFlag || "",
          teamBFlag: rawEvent.teamBFlag || "",
          startTime: startTime,
          endTime: endTime,
          eventLogo: rawEvent.eventLogo || "",
          link_names: rawEvent.link_names || []
        }
      };
    });
  }, [rawMatches]);

  const currentMatch = useMemo(() => {
    if (!matches) return null;
    return matches.find((m) => id.endsWith(m.id.toString()) || m.id.toString() === id);
  }, [matches, id]);

  let streamFetchUrl: string | null = null;
  let cacheKey: string | null = null;
  if (currentMatch && currentMatch.links && STREAM_API_BASE) {
    const streamSlug = currentMatch.links.replace("pro/", "").replace(".txt", "");
    cacheKey = `aiorbd_stream_cache_${streamSlug}`;
    if (STREAM_API_BASE.includes("firebaseio.com")) {
      const base = STREAM_API_BASE.endsWith('/') ? STREAM_API_BASE : `${STREAM_API_BASE}/`;
      streamFetchUrl = `${base}${streamSlug}.json`;
    } else {
      const base = STREAM_API_BASE.endsWith('/') ? STREAM_API_BASE : `${STREAM_API_BASE}/`;
      streamFetchUrl = `${base}${streamSlug}`;
    }
  }

  const getCachedStreams = () => {
    if (typeof window === 'undefined' || !cacheKey) return null;
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (e) { return null; }
  };

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: false,
    fallbackData: getCachedStreams(),
    onSuccess: (data) => {
      if (typeof window !== 'undefined' && cacheKey && data) {
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    }
  });

  const streams = Array.isArray(streamsFromApi) ? streamsFromApi : (streamsFromApi?.streams || null);

  useEffect(() => { streamsRef.current = streams; }, [streams]);
  useEffect(() => { activeIndexRef.current = activeStreamIndex; }, [activeStreamIndex]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveStreamIndex(0);
    setAllServersDown(false);
    setReloadTrigger(prev => prev + 1);
  }, [id]);

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
      return () => clearTimeout(timer);
    }
  }, [showFitToast, objectFit]);

  const triggerNextServer = useCallback(() => {
    const currentStreams = streamsRef.current;
    const currentIndex = activeIndexRef.current;
    if (currentStreams && currentIndex < currentStreams.length - 1) {
      console.log(`[Critical Error] Server ${currentIndex + 1} Failed. Switching to Server ${currentIndex + 2}`);
      setActiveStreamIndex(currentIndex + 1);
    } else {
      console.log("All servers are down.");
      setAllServersDown(true);
      setIsBuffering(false);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;
    let shaka: any; let player: any; let ui: any;
    const initPlayer = async () => {
      try {
        shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();
        try {
          if (shaka.ui.Controls && !(shaka.ui.Controls as any).custom_stretch_registered) {
            class StretchButton extends shaka.ui.Element {
              constructor(parent: HTMLElement, controls: any) {
                super(parent, controls);
                const button = document.createElement('button');
                button.className = 'shaka-custom-stretch-btn shaka-tooltip';
                button.setAttribute('aria-label', 'Toggle Fit');
                button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
                this.eventManager.listen(button, 'click', () => window.dispatchEvent(new CustomEvent('toggleObjectFit')));
                parent.appendChild(button);
              }
            }
            shaka.ui.Controls.registerElement('custom_stretch', { create: (root: HTMLElement, ctrls: any) => new StretchButton(root, ctrls) });
            (shaka.ui.Controls as any).custom_stretch_registered = true;
          }
        } catch (e) {}
        player = new shaka.Player(videoRef.current);
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'overflow_menu', 'fullscreen'],
          addSeekBar: true,
          trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat.LABEL
        });
        document.addEventListener('fullscreenchange', () => {
          if (document.fullscreenElement && window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
            (window.screen.orientation as any).lock('landscape').catch(() => {});
          }
        });
        player.addEventListener('buffering', (e: any) => setIsBuffering(e.buffering));
        player.addEventListener('error', (e: any) => {
          if (e.detail && e.detail.severity === 2 && e.detail.code !== 7000 && e.detail.code !== 7002) {
            console.error("Shaka Critical Fatal Error:", e.detail.code);
            triggerNextServer();
          }
        });
        setPlayerInstance(player);
      } catch (err) {
        console.error("Init Error", err);
      }
    };
    initPlayer();
    return () => {
      if (ui) ui.destroy();
      if (player) player.destroy();
    };
  }, [triggerNextServer]);

  useEffect(() => {
    if (!playerInstance || !streams || streams.length === 0 || allServersDown) return;
    const currentStream = streams[activeStreamIndex];
    if (!currentStream || !currentStream.link) return;
    let isMounted = true;
    const loadVideo = async () => {
      setIsBuffering(true);
      try {
        await playerInstance.unload();
        
        // 🟢 হুবহু আপনার অরিজিনাল শাকা কনফিগারেশন ফিরিয়ে আনা হলো (DASH/MPD এর জন্য ১০০% টেস্টেড)
        playerInstance.configure({
          streaming: {
            bufferingGoal: 10,
            rebufferingGoal: 1,
            bufferBehind: 5,
            jumpLargeGaps: true,
            ignoreTextStreamFailures: true,
            retryParameters: { maxAttempts: 10, baseDelay: 1000, backoffFactor: 1.5, fuzzFactor: 0.5, timeout: 10000 },
            stallEnabled: true,
            stallThreshold: 1,
            stallSkip: 0.5
          },
          manifest: {
            dash: { ignoreMinBufferTime: true },
            hls: { ignoreManifestProgramDateTime: true },
            retryParameters: { maxAttempts: 10, baseDelay: 1000, timeout: 10000 }
          },
          abr: {
            enabled: true,
            switchInterval: 1,
            bandwidthDowngradeTarget: 0.99,
            bandwidthUpgradeTarget: 0.50,
            defaultBandwidthEstimate: 300000,
            restrictToElementSize: true,
            safeMarginSwitch: true,
            clearBufferSwitch: true
          }
        });
        if (currentStream.api) {
          const cleanDrm = currentStream.api.replace(/['"\s]/g, '');
          if (cleanDrm.includes(':')) {
            const [kid, key] = cleanDrm.split(':');
            playerInstance.configure({ drm: { clearKeys: { [kid]: key } } });
          }
        }
        await playerInstance.load(currentStream.link);
      } catch (error: any) {
        if (error.code !== 7000 && error.code !== 7002) {
          console.error("Initial Load Failed, Switching Server...", error.code);
          if (isMounted) triggerNextServer();
        }
      } finally {
        if (isMounted) setIsBuffering(false);
      }
    };
    loadVideo();
    return () => { isMounted = false; };
  }, [playerInstance, streams, activeStreamIndex, reloadTrigger, allServersDown, triggerNextServer]);

  const handleUserActivity = () => {
    setIsControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setIsControlsVisible(false), 3000);
  };

  const handleShare = async () => {
    const matchTitle = currentMatch && currentMatch.eventInfo ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}` : 'Live Match';
    const shareUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: matchTitle, url: shareUrl }); } catch (error) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 outline-none transition-colors active:scale-[0.95]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-bold hidden sm:inline">Back to Home</span>
            </button>
          </Link>
          <span className="text-sm md:text-base font-bold text-gray-100 truncate max-w-xs sm:max-w-md tracking-wide">
            {currentMatch && currentMatch.eventInfo ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}` : "Live Streaming"}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 mt-4 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="lg:col-span-2 flex flex-col">
          <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-xl border border-gray-800 shaka-video-container group" onMouseMoveCapture={handleUserActivity} onTouchStartCapture={handleUserActivity} onClickCapture={handleUserActivity} onMouseLeave={() => setIsControlsVisible(false)} >
            {!streams && !allServersDown && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/90 z-10 flex-col gap-3">
                <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[#00E5FF] font-bold text-sm animate-pulse tracking-wider">Fetching Secure Stream...</span>
              </div>
            )}
            
            {/* 🎯 ফিক্স: আগের সেই বিশ্রী ব্লার ওভারলে স্ক্রিন পুরোপুরি বাদ! এখন নিচে ছোট্ট ফ্লোটিং টোস্ট মেসেজ আকারে কানেক্টিং দেখাবে */}
            {isBuffering && !allServersDown && streams && (
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 border border-[#00E5FF]/30 px-5 py-2.5 rounded-full flex items-center gap-2 pointer-events-none shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                <div className="w-4 h-4 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-white font-bold text-xs tracking-wide whitespace-nowrap">Connecting to Server {activeStreamIndex + 1}...</p>
              </div>
            )}
            
            {allServersDown && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/95 z-50 flex-col gap-4 text-center p-4">
                <span className="text-4xl">📡</span>
                <div className="text-red-400 font-bold tracking-wide">Stream Currently Unavailable</div>
                <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); setReloadTrigger(prev => prev + 1); }} className="mt-2 bg-[#1C1E2B] border border-gray-700 hover:border-[#00E5FF] text-white px-5 py-2 rounded-full text-xs font-bold">Retry Server 1</button>
              </div>
            )}
            <video ref={videoRef} className={`w-full h-full transition-all duration-300 pointer-events-none ${objectFit === 'fill' ? 'object-fill' : objectFit === 'cover' ? 'object-cover' : 'object-contain'}`} autoPlay playsInline />
            <AnimatePresence>
              {showFitToast && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-6 left-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700/50 shadow-xl z-50 flex items-center gap-2 pointer-events-none" >
                  <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></span>
                  <span className="text-xs md:text-sm font-bold text-white capitalize">{objectFit === 'contain' ? 'Fit to Screen' : objectFit === 'cover' ? 'Zoom (Cropped)' : 'Stretch (Fill)'}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {streams && streams.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide py-4 my-2 border-b border-gray-800/40 items-center">
              <span className="text-gray-400 font-bold text-xs md:text-sm mr-2 whitespace-nowrap uppercase tracking-wider">Servers:</span>
              {streams.map((stream: any, index: number) => (
                <button key={index} onClick={() => { setAllServersDown(false); if (activeStreamIndex === index) { setReloadTrigger(prev => prev + 1); } else { setActiveStreamIndex(index); } }} className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border outline-none duration-150 ${activeStreamIndex === index && !allServersDown ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]" : "bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white"}`} >
                  {stream.title || (currentMatch?.eventInfo as any)?.link_names?.[index] || `Server ${index + 1}`}
                </button>
              ))}
            </div>
          )}
          {currentMatch && currentMatch.eventInfo ? (
            <div className="bg-[#1C1E2B] border border-[#00E5FF]/40 rounded-[20px] p-5 mt-3 shadow-lg relative group">
              <button onClick={handleShare} className="absolute top-4 right-4 bg-gray-800/50 hover:bg-[#00E5FF]/20 text-gray-400 hover:text-[#00E5FF] p-2 rounded-full border border-gray-700/50 transition-all z-10"><svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
              {showCopied && <div className="absolute -top-8 right-2 bg-[#00E5FF] text-black text-[10px] font-bold px-3 py-1 rounded shadow-lg">Link Copied!</div>}
              <div className="text-center text-xs font-bold text-[#00E5FF] uppercase tracking-widest mb-4 pr-8">{currentMatch.eventInfo.eventCat} | {currentMatch.eventInfo.eventName}</div>
              <div className="flex justify-center items-center gap-6 sm:gap-12 py-2">
                <div className="flex items-center gap-3 w-[40%] justify-end">
                  <span className="font-bold text-sm md:text-base text-gray-200 text-right truncate">{currentMatch.eventInfo.teamA}</span>
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700/50 flex-shrink-0 relative"><Image unoptimized src={getImg(currentMatch.eventInfo.teamAFlag)} fill className="object-cover" alt="" /></div>
                </div>
                <span className="text-gray-400 font-black italic text-sm md:text-base px-2">VS</span>
                <div className="flex items-center gap-3 w-[40%] justify-start">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700/50 flex-shrink-0 relative"><Image unoptimized src={getImg(currentMatch.eventInfo.teamBFlag)} fill className="object-cover" alt="" /></div>
                  <span className="font-bold text-sm md:text-base text-gray-200 text-left truncate">{currentMatch.eventInfo.teamB}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-6 lg:mt-0 lg:col-span-1 max-h-[70vh] lg:max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide pr-1">
          <div className="flex flex-col gap-3.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-400 pl-1 mb-1">More Live Events</span>
            {matches && matches.map((match: any) => {
              if (!match.eventInfo) return null;
              const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
              const isCurrent = id.endsWith(match.id.toString()) || match.id.toString() === id;
              const slugLink = generateSlug(match.eventInfo.teamA, match.eventInfo.teamB, match.eventInfo.eventName, match.id);
              return (
                <Link href={`/watch/${slugLink}`} key={match.id} className="outline-none" prefetch={false}>
                  <motion.div whileTap={{ scale: 0.97 }} className={`bg-[#1C1E2B] border rounded-[18px] p-4 transition-all duration-150 ${isCurrent ? 'border-[#00E5FF] shadow-md ring-1 ring-[#00E5FF]/30' : 'border-gray-800/80 hover:border-[#00E5FF]/40'}`}>
                    <div className="text-[11px] text-gray-400 mb-2 truncate uppercase tracking-wide">{match.eventInfo.eventCat} • {match.eventInfo.eventName}</div>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex items-center gap-2 truncate max-w-[40%]">
                        <img src={getImg(match.eventInfo.teamAFlag)} className="w-5 h-5 rounded-full object-cover min-w-[20px]" alt="" />
                        <span className="text-xs font-bold truncate text-gray-200">{match.eventInfo.teamA}</span>
                      </div>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${status.type === 'live' ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' : 'bg-blue-500/10 text-blue-400 border border-blue-500/10'}`}>{status.label}</span>
                      <div className="flex items-center gap-2 truncate max-w-[40%] justify-end">
                        <span className="text-xs font-bold truncate text-gray-200 text-right">{match.eventInfo.teamB}</span>
                        <img src={getImg(match.eventInfo.teamBFlag)} className="w-5 h-5 rounded-full object-cover min-w-[20px]" alt="" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .shaka-custom-stretch-btn { background: transparent; border: none; color: white; cursor: pointer; padding: 5px; opacity: 0.8; display: flex; align-items: center; justify-content: center; } 
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        
        /* 👑 ফিক্স: শাকার ডিফল্ট কালো ওভারলে স্ক্রিম চিরতরে অফ করা হলো */
        .shaka-scrim-container { display: none !important; background: transparent !important; }
      `}} />
      <Script src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js" strategy="lazyOnload" id="adsterra-popunder" />
    </main>
  );
}
