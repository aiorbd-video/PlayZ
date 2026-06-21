'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

interface Stream {
  title?: string;
  link: string;
  api?: string;
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
  // ==========================================
  // 1. UI & PLAYER REFS
  // ==========================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerInitRef = useRef(false);

  // ==========================================
  // 2. STREAM MANAGER REFS (Failover & Timers)
  // ==========================================
  const streamsRef = useRef<Stream[] | null>(null);
  const currentlyPlayingUrlRef = useRef<string | null>(null);
  const activeIndexRef = useRef<number>(0);
  const retryCountRef = useRef(0);
  const maxRetry = 2;
  
  // 🎯 Fix 4: TTL Based Blacklist (Auto recovery after 2 mins)
  const failedServersRef = useRef<Map<number, number>>(new Map());
  
  // Central Timers
  const timersRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const failoverLockRef = useRef(false);
  const failoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorLockRef = useRef(false);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 🎯 Fix 2 & 3: Stable Handlers & Stale Closure Prevention
  const bufferingHandlerRef = useRef<any>(null);
  const errorHandlerRef = useRef<any>(null);
  const lastProgressRef = useRef<number>(Date.now());
  const isBufferingRef = useRef<boolean>(true); // For setInterval access

  // ==========================================
  // 3. REACT STATE
  // ==========================================
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  
  // 🎯 Fix 6: UI Only Clock (No heavy re-renders for core player)
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // ==========================================
  // 4. DATA FETCHING LAYER (SWR)
  // ==========================================
  const { data: rawMatches } = useSWR(LIVE_EVENTS_API ? LIVE_EVENTS_API : null, fetcher, { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false });

  const matches = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;
    return rawMatches.map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const convertDate = (dStr: string, tStr: string) => {
        if (!dStr || !tStr) return "";
        const parts = dStr.split('/');
        let datePart = dStr;
        if (parts.length === 3) datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
        // 🎯 Fix 3: Safer timezone parsing (Option A: Keep Local BD Time strings)
        return `${datePart}T${tStr}:00+06:00`;
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
          startTime, endTime,
          eventLogo: rawEvent.eventLogo || "",
          link_names: rawEvent.link_names || []
        }
      };
    });
  }, [rawMatches]);

  const matchMap = useMemo(() => new Map((matches ?? []).map((m: any) => [String(m.id), m])), [matches]);

  const currentMatch = useMemo(() => {
    if (!matchMap) return null;
    let match = matchMap.get(id);
    if (!match) match = matchMap.get(id.split('-').pop() || id);
    return match || null;
  }, [matchMap, id]);

  const streamFetchUrl = useMemo(() => {
    if (currentMatch && currentMatch.links && STREAM_API_BASE) {
      const streamSlug = currentMatch.links.replace("pro/", "").replace(".txt", "");
      const base = STREAM_API_BASE.endsWith('/') ? STREAM_API_BASE : `${STREAM_API_BASE}/`;
      return STREAM_API_BASE.includes("firebaseio.com") ? `${base}${streamSlug}.json` : `${base}${streamSlug}`;
    }
    return null;
  }, [currentMatch]);

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;
    let rawList: any[] | null = null;
    if (Array.isArray(streamsFromApi)) rawList = streamsFromApi;
    else if (streamsFromApi.streams && Array.isArray(streamsFromApi.streams)) rawList = streamsFromApi.streams;
    if (!rawList) return null;
    
    return rawList.filter(s => s && typeof s.link === 'string').map(s => ({
      ...s,
      title: typeof s.title === 'string' ? s.title : undefined,
      api: typeof s.api === 'string' ? s.api : undefined
    }));
  }, [streamsFromApi]);

  const currentStreamUrl = useMemo(() => {
    if (!streams?.length) return null;
    return streams[activeStreamIndex]?.link || null;
  }, [streams, activeStreamIndex]);

  useEffect(() => { streamsRef.current = streams; }, [streams]);
  useEffect(() => { activeIndexRef.current = activeStreamIndex; }, [activeStreamIndex]);

  useEffect(() => {
    setActiveStreamIndex(0);
    setAllServersDown(false);
    currentlyPlayingUrlRef.current = null;
    failedServersRef.current.clear();
    retryCountRef.current = 0;
  }, [id]);

  // ==========================================
  // 5. STREAM MANAGER (Failover & Recovery)
  // ==========================================
  
  // 🎯 Fix 5: Cache-busting using query parameter for universal CDN support
  const getFreshUrl = useCallback((url: string) => {
    return url + (url.includes('?') ? '&' : '?') + '__t=' + Date.now();
  }, []);

  const safeSwitchServer = useCallback(() => {
    if (failoverLockRef.current) return;
    failoverLockRef.current = true;
    retryCountRef.current = 0;

    setActiveStreamIndex((prevIndex) => {
      const list = streamsRef.current;
      if (!list) return prevIndex;
      
      // 🎯 Fix 4: Add current to TTL Blacklist
      failedServersRef.current.set(prevIndex, Date.now());
      
      let nextValidIndex = -1;
      const now = Date.now();
      
      for (let i = 0; i < list.length; i++) {
        const failedTime = failedServersRef.current.get(i);
        // Valid if never failed OR failed more than 2 minutes (120000ms) ago
        if (!failedTime || now - failedTime > 120000) {
          nextValidIndex = i;
          break;
        }
      }

      if (nextValidIndex !== -1) {
        console.log(`[Failover] Switching to Server ${nextValidIndex + 1}`);
        return nextValidIndex;
      } else {
        console.log("[Failover] All servers blacklisted. Stream Unavailable.");
        setAllServersDown(true);
        setIsBuffering(false);
        isBufferingRef.current = false;
        return prevIndex;
      }
    });

    if (failoverTimeoutRef.current) clearTimeout(failoverTimeoutRef.current);
    failoverTimeoutRef.current = setTimeout(() => { failoverLockRef.current = false; }, 3000);
  }, []);

  const forceReloadStream = useCallback(() => {
    if (playerRef.current && currentlyPlayingUrlRef.current) {
      playerRef.current.unload().then(() => {
        playerRef.current.load(getFreshUrl(currentlyPlayingUrlRef.current!));
      }).catch(() => {});
    }
  }, [getFreshUrl]);

  const handleStreamError = useCallback(async (error: any) => {
    if (errorLockRef.current) return;
    errorLockRef.current = true;
    
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => { errorLockRef.current = false; }, 2000);

    const code = error?.detail?.code || error?.code;
    const severity = error?.detail?.severity || error?.severity;
    console.log("Stream Error:", code);

    if (code === 7000 || code === 7002) return;

    if (code === 1001 || code === 1002 || code === 6002 || code === 3016 || code === 3015 || severity === 2) {
      if (retryCountRef.current < maxRetry) {
        retryCountRef.current++;
        forceReloadStream();
        return;
      }
      safeSwitchServer();
    }
  }, [forceReloadStream, safeSwitchServer]);

  // Bind safe refs for Shaka events
  errorHandlerRef.current = handleStreamError;
  bufferingHandlerRef.current = (e: any) => {
    setIsBuffering(e.buffering);
    isBufferingRef.current = e.buffering;
  };
  // ==========================================
  // 6. PLAYER LAYER (Shaka Logic)
  // ==========================================
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current) return;
    if (playerInitRef.current) return;
    
    let shaka: any; let player: any; let ui: any;
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
        playerRef.current = player;
        
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'overflow_menu', 'fullscreen'],
          addSeekBar: true,
          trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat.LABEL
        });
        
        const handleFullscreen = () => {
          if (document.fullscreenElement && window.screen?.orientation && (window.screen.orientation as any).lock) {
            (window.screen.orientation as any).lock('landscape').catch(() => {});
          }
        };
        document.addEventListener('fullscreenchange', handleFullscreen);
        (ui as any).cleanupFullscreen = () => document.removeEventListener('fullscreenchange', handleFullscreen);
        
        // 🎯 Fix 1: Named timeupdate handler and strict cleanup
        const handleTimeUpdate = () => { lastProgressRef.current = Date.now(); };
        videoRef.current?.addEventListener('timeupdate', handleTimeUpdate);
        (ui as any).cleanupTimeUpdate = () => videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);

        // 🎯 Fix 2 & 3: Safe stall detection using stable Ref
        const checkStall = setInterval(() => {
          if (isBufferingRef.current && (Date.now() - lastProgressRef.current > 10000)) {
            console.log("Stall detected via timestamp → Switching server");
            safeSwitchServer();
          }
        }, 5000);
        timersRef.current.add(checkStall);
        
        // 🎯 Fix 6: Safe named handler routing to prevent duplicate binds
        const onBuffering = (e: any) => { if (bufferingHandlerRef.current) bufferingHandlerRef.current(e); };
        const onError = (e: any) => { if (errorHandlerRef.current) errorHandlerRef.current(e); };
        
        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);
        
        (ui as any).cleanupShakaEvents = () => {
          player.removeEventListener('buffering', onBuffering);
          player.removeEventListener('error', onError);
        };
        
        playerInitRef.current = true;
        
      } catch (err) {
        console.error("Init Error", err);
        playerInitRef.current = false;
      }
    };
    
    initPlayer();
    
    return () => {
      isCancelled = true;
      if (playerRef.current) playerInitRef.current = false;
      
      if (ui) {
        if ((ui as any).cleanupFullscreen) (ui as any).cleanupFullscreen();
        if ((ui as any).cleanupTimeUpdate) (ui as any).cleanupTimeUpdate();
        if ((ui as any).cleanupShakaEvents) (ui as any).cleanupShakaEvents();
        ui.destroy();
      }
      
      if (playerRef.current) {
        try { playerRef.current.unload(); } catch {}
        playerRef.current.destroy();
        playerRef.current = null;
      }
      
      timersRef.current.forEach(clearTimeout);
      timersRef.current.clear();
      timersRef.current.forEach(clearInterval);
    };
  }, []); // 🚀 Clean dependency array!

  // 🎯 Stream URL Load Watcher
  useEffect(() => {
    if (!playerRef.current || !streams || streams.length === 0 || allServersDown || !currentStreamUrl) return;
    if (currentlyPlayingUrlRef.current === currentStreamUrl) return;

    let isMounted = true;
    const loadVideo = async () => {
      setIsBuffering(true);
      isBufferingRef.current = true;
      
      try {
        await playerRef.current.unload();
        
        playerRef.current.configure({
          streaming: {
            bufferingGoal: 15, rebufferingGoal: 1, bufferBehind: 20, bufferLead: 10,
            startAtSegmentBoundary: true, jumpLargeGaps: true, smallGapLimit: 2,
            ignoreTextStreamFailures: true, inaccurateManifestTolerance: 2, lowLatencyMode: false,
            stallEnabled: true, stallThreshold: 1, stallSkip: 0.5,
            retryParameters: { maxAttempts: 15, baseDelay: 500, timeout: 15000 }
          },
          manifest: {
            retryParameters: { maxAttempts: 15, baseDelay: 500, timeout: 15000 },
            dash: { ignoreMinBufferTime: true, autoCorrectDrift: true },
            hls: { ignoreManifestProgramDateTime: true, sequenceMode: true }
          },
          abr: {
            enabled: true, switchInterval: 2, bandwidthDowngradeTarget: 0.95, 
            bandwidthUpgradeTarget: 0.75, restrictToElementSize: true, 
            clearBufferSwitch: false, safeMarginSwitch: true
          }
        });
        
        const currentStreamObj = streams[activeStreamIndex];
        if (currentStreamObj && currentStreamObj.api) {
          const cleanDrm = currentStreamObj.api.replace(/['"\s]/g, '');
          const parts = cleanDrm.split(':');
          if (parts.length >= 2) {
            const kid = parts[0];
            const key = parts.slice(1).join(':');
            playerRef.current.configure({ drm: { clearKeys: { [kid]: key } } });
          }
        }
        
        const freshUrl = getFreshUrl(currentStreamUrl);
        try {
          await playerRef.current.load(freshUrl);
          currentlyPlayingUrlRef.current = currentStreamUrl; 
        } catch (err: any) {
          console.log("Load failed:", err?.code);
          if (retryCountRef.current < maxRetry) {
            retryCountRef.current++;
            forceReloadStream();
            return;
          }
          if (isMounted) safeSwitchServer();
        }

      } catch (error: any) {
        if (error.code !== 7000 && error.code !== 7002) {
          if (isMounted) safeSwitchServer();
        }
      } finally {
        if (isMounted) {
          setIsBuffering(false);
          isBufferingRef.current = false;
        }
      }
    };
    loadVideo();
    return () => { isMounted = false; };
  }, [currentStreamUrl, streams, activeStreamIndex, allServersDown, getFreshUrl, safeSwitchServer, forceReloadStream]);

  // ==========================================
  // 7. EVENT LISTENERS & UI EFFECTS
  // ==========================================
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden && isBufferingRef.current) forceReloadStream(); };
    const handleOnline = () => { forceReloadStream(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [forceReloadStream]);

  useEffect(() => {
    const blockInspect = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'C' || e.key === 'J'))) { e.preventDefault(); }
    };
    document.addEventListener('contextmenu', blockInspect);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockInspect);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  const handleFitToggle = useCallback(() => {
    const fitModes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
    setObjectFit(prev => {
      const next = fitModes[(fitModes.indexOf(prev) + 1) % fitModes.length];
      setShowFitToast(true);
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('toggleObjectFit', handleFitToggle);
    return () => window.removeEventListener('toggleObjectFit', handleFitToggle);
  }, [handleFitToggle]);

  useEffect(() => {
    if (showFitToast) {
      const t = setTimeout(() => setShowFitToast(false), 2000);
      timersRef.current.add(t);
      return () => { clearTimeout(t); timersRef.current.delete(t); };
    }
  }, [showFitToast, objectFit]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.style.objectFit = objectFit;
  }, [objectFit]);

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
      const t = setTimeout(() => setShowCopied(false), 2000);
      timersRef.current.add(t);
    }
  };

  // ==========================================
  // 8. RENDER JSX
  // ==========================================
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
          <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-xl border border-gray-800 shaka-video-container group" onMouseMoveCapture={handleUserActivity} onTouchStartCapture={handleUserActivity} onClickCapture={handleUserActivity} onMouseLeave={() => setIsControlsVisible(false)}>
            
            {!streams && !allServersDown && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/90 z-10 flex-col gap-3">
                <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[#00E5FF] font-bold text-sm animate-pulse tracking-wider">Fetching Secure Stream...</span>
              </div>
            )}

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
                <button onClick={() => { setAllServersDown(false); setActiveStreamIndex(0); currentlyPlayingUrlRef.current = null; failedServersRef.current.clear(); }} className="mt-2 bg-[#1C1E2B] border border-gray-700 hover:border-[#00E5FF] text-white px-5 py-2 rounded-full text-xs font-bold">Retry Server 1</button>
              </div>
            )}

            <video ref={videoRef} autoPlay playsInline preload="auto" muted={false} className={`w-full h-full transition-all duration-300 pointer-events-none`} />

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
              {streams.map((stream, index) => {
                const isFailed = failedServersRef.current.has(index);
                return (
                  <button key={index} onClick={() => { failedServersRef.current.delete(index); setAllServersDown(false); setActiveStreamIndex(index); currentlyPlayingUrlRef.current = null; }} className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border outline-none duration-150 ${activeStreamIndex === index && !allServersDown ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]" : isFailed ? "bg-red-900/20 border-red-900/50 text-red-500/50 hover:bg-red-900/40" : "bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white"}`} >
                    {stream.title || `Server ${index + 1}`}
                  </button>
                );
              })}
            </div>
          )}

          {currentMatch && currentMatch.eventInfo ? (
            <div className="bg-[#1C1E2B] border border-[#00E5FF]/40 rounded-[20px] p-5 mt-3 shadow-lg relative group">
              <button onClick={handleShare} className="absolute top-4 right-4 bg-gray-800/50 hover:bg-[#00E5FF]/20 text-gray-400 hover:text-[#00E5FF] p-2 rounded-full border border-gray-700/50 transition-all z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
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
        .shaka-scrim-container { display: none !important; background: transparent !important; }
      `}} />
      <Script src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js" strategy="lazyOnload" id="adsterra-popunder" />
    </main>
  );
      }
