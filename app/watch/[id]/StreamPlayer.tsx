'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import 'shaka-player/dist/controls.css';
import Script from 'next/script';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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
  link_names?: string[];
}

interface Match {
  id: number | string;
  eventInfo: EventInfo;
  links?: string;
}

interface ServerFailureRecord {
  time: number;
  attempts: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const LIVE_EVENTS_API =
  process.env.NEXT_PUBLIC_LIVE_EVENTS_API ||
  'https://ratulxadia-playz-cats-event.hf.space/api/events';

const STREAM_API_BASE =
  process.env.NEXT_PUBLIC_STREAM_API_BASE ||
  'https://ratulxadia-playz-cats-event.hf.space/api/stream/';

const IMG_PROXY =
  process.env.NEXT_PUBLIC_IMG_PROXY || 'https://img.aiorbd.workers.dev/?url=';

const CONFIG = {
  maxRetry: 2,
  baseRetryDelay: 1000,
  failoverCooldown: 500, // 🎯 ফিক্সড: ২.৫ সেকেন্ড থেকে কমিয়ে ৫০০ms করা হলো যাতে সাথে সাথে সুইচ হয়
  stallDetectionDelay: 25000,
  stallCheckInterval: 5000,
  serverBlacklistDuration: 30000, // 🎯 ফিক্সড: ৬০ সেকেন্ডের জায়গায় ৩০ সেকেন্ড করা হলো
  controlsHideDelay: 3000,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined | null) => {
  if (!url || url === 'null') return '/fallback-logo.png';
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMimeType = (url: string): string | undefined => {
  if (url.includes('.mpd')) return 'application/dash+xml';
  if (url.includes('.m3u8')) return 'application/x-mpegURL';
  return undefined;
};

const convertDate = (dStr: string, tStr: string): string => {
  if (!dStr || !tStr) return '';

  try {
    let day = 1,
      month = 1,
      year = 2026;

    if (dStr.includes('/')) {
      const parts = dStr.split('/');
      [day, month, year] = [
        parseInt(parts[0], 10),
        parseInt(parts[1], 10),
        parseInt(parts[2], 10),
      ];
    } else if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts[0].length === 4) {
        [year, month, day] = [
          parseInt(parts[0], 10),
          parseInt(parts[1], 10),
          parseInt(parts[2], 10),
        ];
      } else {
        [day, month, year] = [
          parseInt(parts[0], 10),
          parseInt(parts[1], 10),
          parseInt(parts[2], 10),
        ];
      }
    }

    const timeParts = tStr.split(':');
    let hours = (parseInt(timeParts[0], 10) || 0) + 12;
    const minutes = parseInt(timeParts[1], 10) || 0;
    const seconds = parseInt(timeParts[2], 10) || 0;

    const utcTimestamp = Date.UTC(year, month - 1, day, hours - 6, minutes, seconds);
    return new Date(utcTimestamp).toISOString();
  } catch {
    return '';
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StreamPlayer({ id }: { id: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const playerInitRef = useRef(false);
  const isCancelledRef = useRef(false);

  const streamsRef = useRef<Stream[] | null>(null);
  const currentlyPlayingUrlRef = useRef<string | null>(null);
  const lastAppliedDrmRef = useRef<string | null>(null);

  const lastFailoverTimeRef = useRef(0);
  const failoverLockRef = useRef(false);
  const retryCountRef = useRef(0);

  const timersRef = useRef<Set<ReturnType<typeof setTimeout | typeof setInterval>>>(
    new Set()
  );

  const lastProgressRef = useRef(Date.now());

  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [objectFit, setObjectFit] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [showFitToast, setShowFitToast] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [allServersDown, setAllServersDown] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [showCopied, setShowCopied] = useState(false);
  const [failedServers, setFailedServers] = useState<Record<string, ServerFailureRecord>>({});
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: rawMatches } = useSWR(LIVE_EVENTS_API ? LIVE_EVENTS_API : null, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const matches = useMemo(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return null;

    return rawMatches.map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const startTime = convertDate(rawEvent.date, rawEvent.time);
      const endTime = convertDate(
        rawEvent.end_date || rawEvent.date,
        rawEvent.end_time || rawEvent.time
      );
      const matchId = rawEvent.links
        ? rawEvent.links.replace('pro/', '').replace('.txt', '')
        : index.toString();

      return {
        id: matchId,
        links: rawEvent.links || '',
        eventInfo: {
          eventCat: rawEvent.category || 'Live Event',
          eventName: rawEvent.eventName || 'Live Match',
          teamA: rawEvent.teamAName || 'Team A',
          teamB: rawEvent.teamBName || 'Team B',
          teamAFlag: rawEvent.teamAFlag || '',
          teamBFlag: rawEvent.teamBFlag || '',
          startTime,
          endTime,
          eventLogo: rawEvent.eventLogo || '',
          link_names: rawEvent.link_names || [],
        },
      };
    });
  }, [rawMatches]);

  const matchMap = useMemo(
    () => new Map((matches ?? []).map((m: any) => [String(m.id), m])),
    [matches]
  );

  const currentMatch = useMemo(() => {
    let match = matchMap.get(id);
    if (!match) match = matchMap.get(id.split('-').pop() || id);
    return match || null;
  }, [matchMap, id]);

  const streamFetchUrl = useMemo(() => {
    if (currentMatch?.links && STREAM_API_BASE) {
      const streamSlug = currentMatch.links.replace('pro/', '').replace('.txt', '');
      const base = STREAM_API_BASE.endsWith('/') ? STREAM_API_BASE : `${STREAM_API_BASE}/`;
      return STREAM_API_BASE.includes('firebaseio.com')
        ? `${base}${streamSlug}.json`
        : `${base}${streamSlug}`;
    }
    return null;
  }, [currentMatch]);

  const { data: streamsFromApi } = useSWR(streamFetchUrl, fetcher, {
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const streams = useMemo<Stream[] | null>(() => {
    if (!streamsFromApi) return null;

    const rawList = Array.isArray(streamsFromApi)
      ? streamsFromApi
      : streamsFromApi.streams || [];

    if (rawList.length === 0) return null;

    return rawList
      .filter((s: any) => s && (typeof s.link === 'string' || typeof s.url === 'string'))
      .map((s: any) => ({
        ...s,
        link: s.link || s.url || '',
        title: typeof s.title === 'string' ? s.title : undefined,
        api: typeof s.api === 'string' ? s.api : undefined,
      }));
  }, [streamsFromApi]);

  const currentStreamUrl = useMemo(
    () => streams?.[activeStreamIndex]?.link || null,
    [streams, activeStreamIndex]
  );

  useEffect(() => { streamsRef.current = streams; }, [streams]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveStreamIndex(0);
    setAllServersDown(false);
    setFailedServers({});
    currentlyPlayingUrlRef.current = null;
    lastAppliedDrmRef.current = null;
    lastFailoverTimeRef.current = 0;
    retryCountRef.current = 0;
  }, [id]);

  useEffect(() => {
    const blockInspect = (e: MouseEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'C', 'J'].includes(e.key))) e.preventDefault();
    };
    document.addEventListener('contextmenu', blockInspect);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockInspect);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  const markServerFailed = useCallback((index: number) => {
    setFailedServers((prev) => {
      const current = prev[index] || { time: 0, attempts: 0 };
      return {
        ...prev,
        [index]: { time: Date.now(), attempts: current.attempts + 1 },
      };
    });
  }, []);

  const removeServerFailure = useCallback((index: number) => {
    setFailedServers((prev) => {
      const { [index]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearServerFailures = useCallback(() => { setFailedServers({}); }, []);

  const handleFitToggle = useCallback(() => {
    const fitModes = ['contain', 'cover', 'fill'] as const;
    setObjectFit((prev) => {
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
      const timer = setTimeout(() => setShowFitToast(false), 2000);
      timersRef.current.add(timer);
      return () => { clearTimeout(timer); timersRef.current.delete(timer); };
    }
  }, [showFitToast]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.style.objectFit = objectFit;
  }, [objectFit]);

  // 🎯 ফিক্সড: Auto Switcher এখন চোখের পলকে কাজ করবে
  const safeSwitchServer = useCallback(() => {
    const now = Date.now();

    if (failoverLockRef.current || now - lastFailoverTimeRef.current < CONFIG.failoverCooldown) {
      return;
    }

    failoverLockRef.current = true;
    lastFailoverTimeRef.current = now;
    retryCountRef.current = 0;

    setActiveStreamIndex((prevIndex) => {
      const list = streamsRef.current;
      if (!list) return prevIndex;

      markServerFailed(prevIndex);

      for (let i = 1; i <= list.length; i++) {
        const checkIndex = (prevIndex + i) % list.length;
        const failureRecord = failedServers[checkIndex];
        
        if (!failureRecord) {
          console.log(`[Failover] Switching to Server ${checkIndex + 1}`);
          return checkIndex;
        }

        const cooldown = CONFIG.serverBlacklistDuration * Math.pow(2, failureRecord.attempts - 1);
        if (now - failureRecord.time > cooldown) {
          console.log(`[Failover] Retrying Server ${checkIndex + 1} after cooldown`);
          return checkIndex;
        }
      }

      console.log('[Failover] All servers blacklisted. Stream Unavailable.');
      setAllServersDown(true);
      setIsBuffering(false);
      return prevIndex;
    });

    // 🎯 লক টাইমার ৩ সেকেন্ড থেকে ৫০০ms করা হলো যাতে ডাবল এরর আসলে আটকে না থাকে
    const lockTimer = setTimeout(() => {
      failoverLockRef.current = false;
    }, 500);
    timersRef.current.add(lockTimer);
  }, [markServerFailed, failedServers]);
// ========================================================================
  // HANDLERS: STREAM LOADING & ERROR
  // ========================================================================

  const forceReloadStream = useCallback(() => {
    if (!playerRef.current || !currentlyPlayingUrlRef.current) return;

    const mimeType = getMimeType(currentlyPlayingUrlRef.current);
    playerRef.current
      .unload()
      .then(() => {
        return playerRef.current.load(currentlyPlayingUrlRef.current!, null, mimeType);
      })
      .catch(() => {
        // Silently fail, fallback to safeSwitchServer
      });
  }, []);

  const handleStreamError = useCallback(
    async (error: any) => {
      const code = error?.detail?.code || error?.code;
      const severity = error?.detail?.severity || error?.severity;

      console.log('[Stream Error]', { code, severity });

      if (code === 7000 || code === 7002) return;

      if ([1001, 1002, 6002, 3016, 3015].includes(code) || severity === 2) {
        if (retryCountRef.current < CONFIG.maxRetry) {
          retryCountRef.current++;
          const backoffDelay = CONFIG.baseRetryDelay * retryCountRef.current;
          console.log(`[Retry] Retrying in ${backoffDelay}ms...`);

          const retryTimer = setTimeout(forceReloadStream, backoffDelay);
          timersRef.current.add(retryTimer);
          return;
        }
      }

      // Max retries exceeded or unrecoverable error
      safeSwitchServer();
    },
    [forceReloadStream, safeSwitchServer]
  );

  // ========================================================================
  // LIFECYCLE: PLAYER INITIALIZATION
  // ========================================================================

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || playerInitRef.current) {
      return;
    }

    playerInitRef.current = true;
    isCancelledRef.current = false;

    let shaka: any;
    let player: any;
    let ui: any;

    const initPlayer = async () => {
      try {
        shaka = await import('shaka-player/dist/shaka-player.ui');

        if (isCancelledRef.current) return;

        shaka.polyfill.installAll();

        if (shaka.ui.Controls && !(shaka.ui.Controls as any).custom_stretch_registered) {
          class StretchButton extends shaka.ui.Element {
            constructor(parent: HTMLElement, controls: any) {
              super(parent, controls);
              const button = document.createElement('button');
              button.className = 'shaka-custom-stretch-btn shaka-tooltip';
              button.setAttribute('aria-label', 'Toggle Fit');
              button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
              this.eventManager.listen(button, 'click', () => {
                window.dispatchEvent(new CustomEvent('toggleObjectFit'));
              });
              parent.appendChild(button);
            }
          }
          shaka.ui.Controls.registerElement('custom_stretch', {
            create: (root: HTMLElement, ctrls: any) => new StretchButton(root, ctrls),
          });
          (shaka.ui.Controls as any).custom_stretch_registered = true;
        }

        player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        ui.configure({
          controlPanelElements: [
            'play_pause',
            'time_and_duration',
            'spacer',
            'mute',
            'volume',
            'custom_stretch',
            'overflow_menu',
            'fullscreen',
          ],
          addSeekBar: true,
          trackLabelFormat: shaka.ui.Overlay.TrackLabelFormat.LABEL,
        });

        player.configure({
          streaming: {
            bufferingGoal: 15,
            rebufferingGoal: 1,
            bufferBehind: 20,
            bufferLead: 10,
            startAtSegmentBoundary: true,
            jumpLargeGaps: true,
            smallGapLimit: 2,
            ignoreTextStreamFailures: true,
            inaccurateManifestTolerance: 2,
            lowLatencyMode: false,
            stallEnabled: true,
            stallThreshold: 1,
            stallSkip: 0.5,
            retryParameters: { maxAttempts: 15, baseDelay: 500, timeout: 15000 },
          },
          manifest: {
            retryParameters: { maxAttempts: 15, baseDelay: 500, timeout: 15000 },
            dash: { ignoreMinBufferTime: true, autoCorrectDrift: true },
            hls: { ignoreManifestProgramDateTime: true, sequenceMode: true },
          },
          abr: {
            enabled: true,
            switchInterval: 2,
            bandwidthDowngradeTarget: 0.95,
            bandwidthUpgradeTarget: 0.75,
            restrictToElementSize: true,
            clearBufferSwitch: false,
            safeMarginSwitch: true,
          },
        });

        const handleFullscreen = () => {
          if (
            document.fullscreenElement &&
            window.screen?.orientation &&
            (window.screen.orientation as any).lock
          ) {
            (window.screen.orientation as any).lock('landscape').catch(() => {});
          }
        };
        document.addEventListener('fullscreenchange', handleFullscreen);

        const handleTimeUpdate = () => {
          lastProgressRef.current = Date.now();
        };
        videoRef.current?.addEventListener('timeupdate', handleTimeUpdate);

        const stallCheckTimer = setInterval(() => {
          const isPaused = videoRef.current?.paused;
          const timeSinceProgress = Date.now() - lastProgressRef.current;

          if (!isPaused && isBuffering && timeSinceProgress > CONFIG.stallDetectionDelay) {
            safeSwitchServer();
          }
        }, CONFIG.stallCheckInterval);
        timersRef.current.add(stallCheckTimer);

        const onBuffering = (e: any) => {
          setIsBuffering(true);
        };
        const onError = (e: any) => {
          handleStreamError(e);
        };

        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);

        const cleanup = () => {
          document.removeEventListener('fullscreenchange', handleFullscreen);
          videoRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
          player.removeEventListener('buffering', onBuffering);
          player.removeEventListener('error', onError);
        };

        (ui as any).cleanup = cleanup;
      } catch (err) {
        console.error('[Init Error]', err);
        playerInitRef.current = false;
      }
    };

    initPlayer();

    return () => {
      isCancelledRef.current = true;
      playerInitRef.current = false;

      if (ui) {
        if ((ui as any).cleanup) (ui as any).cleanup();
        ui.destroy();
      }

      if (playerRef.current) {
        try { playerRef.current.unload(); } catch {}
        playerRef.current.destroy();
        playerRef.current = null;
      }

      timersRef.current.forEach((timer) => {
        clearTimeout(timer as any);
        clearInterval(timer as any);
      });
      timersRef.current.clear();
    };
  }, [safeSwitchServer, handleStreamError]);

  // ========================================================================
  // LIFECYCLE: LOAD VIDEO STREAM
  // ========================================================================

  useEffect(() => {
    if (!playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) {
      return;
    }

    if (
      currentlyPlayingUrlRef.current === currentStreamUrl ||
      failedServers[activeStreamIndex]
    ) {
      return;
    }

    let isMounted = true;

    const loadVideo = async () => {
      setIsBuffering(true);

      try {
        await playerRef.current.unload();

        const currentStream = streams[activeStreamIndex];
        const newDrmApi = currentStream?.api || '';

        // 🎯 ফিক্সড: আপনার অরিজিনাল শক্তিশালী JSON DRM Parser রিস্টোর করা হয়েছে
        if (lastAppliedDrmRef.current !== newDrmApi) {
          const clearKeysObj: Record<string, string> = {};
          let parsedData: any = newDrmApi;

          if (typeof newDrmApi === 'string') {
            const trimmed = newDrmApi.trim();
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
            if (parts.length === 2) {
              clearKeysObj[parts[0]] = parts[1];
            }
          }

          if (Object.keys(clearKeysObj).length > 0) {
            playerRef.current.configure({ drm: { clearKeys: clearKeysObj } });
          } else {
            playerRef.current.configure({ drm: { clearKeys: {} } });
          }
          lastAppliedDrmRef.current = newDrmApi;
        }

        const mimeType = getMimeType(currentStreamUrl);
        await playerRef.current.load(currentStreamUrl, null, mimeType);
        currentlyPlayingUrlRef.current = currentStreamUrl;

        if (isMounted) {
          setIsBuffering(false);
        }
      } catch (error: any) {
        console.log('[Load Error]', { code: error?.code });

        if (error?.code !== 7000 && error?.code !== 7002) {
          if (isMounted) {
            // Error আসলে সাথে সাথে SwitchServer কল হবে, কারণ cooldown 500ms এ নামানো হয়েছে
            safeSwitchServer();
          }
        }
      }
    };

    loadVideo();

    return () => {
      isMounted = false;
    };
  }, [
    currentStreamUrl,
    activeStreamIndex,
    allServersDown,
    streams,
    failedServers,
    safeSwitchServer,
  ]);

  // ========================================================================
  // LIFECYCLE: RECOVERY ON VISIBILITY/CONNECTIVITY CHANGE
  // ========================================================================

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && isBuffering) {
        forceReloadStream();
      }
    };

    const handleOnline = () => {
      forceReloadStream();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [forceReloadStream, isBuffering]);

  // ========================================================================
  // HANDLERS: UI CONTROLS
  // ========================================================================

  const handleUserActivity = useCallback(() => {
    setIsControlsVisible(true);
  }, []);

  const handleShare = useCallback(async () => {
    const matchTitle =
      currentMatch?.eventInfo && currentMatch.eventInfo.teamA
        ? `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}`
        : 'Live Match';

    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: matchTitle, url: shareUrl });
      } catch {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setShowCopied(true);
      const timer = setTimeout(() => setShowCopied(false), 2000);
      timersRef.current.add(timer);
    }
  }, [currentMatch]);

  // ========================================================================
  // RENDER
  // ========================================================================

  const matchTitle =
    currentMatch?.eventInfo &&
    `${currentMatch.eventInfo.teamA} VS ${currentMatch.eventInfo.teamB}`;

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 outline-none transition-colors active:scale-[0.95]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-bold hidden sm:inline">Back to Home</span>
            </button>
          </Link>
          <span className="text-sm md:text-base font-bold text-gray-100 truncate max-w-xs sm:max-w-md tracking-wide">
            {matchTitle || 'Live Streaming'}
          </span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-2 sm:px-4 mt-4">
        <div ref={videoContainerRef} className="w-full bg-black aspect-video relative rounded-none sm:rounded-[20px] overflow-hidden shadow-xl border border-gray-800 shaka-video-container group" onMouseMove={handleUserActivity} onTouchStart={handleUserActivity} onClick={handleUserActivity} onMouseLeave={() => setIsControlsVisible(false)}>
          
          {!streams && !allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/90 z-10 flex-col gap-3">
              <div className="w-10 h-10 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
              <span className="text-[#00E5FF] font-bold text-sm animate-pulse tracking-wider">
                Fetching Secure Stream...
              </span>
            </div>
          )}

          {isBuffering && !allServersDown && streams && (
            <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-40 bg-black/80 border border-[#00E5FF]/30 px-5 py-2.5 rounded-full flex items-center gap-2 pointer-events-none shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <div className="w-4 h-4 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
              <p className="text-white font-bold text-xs tracking-wide whitespace-nowrap">
                Connecting to Server {activeStreamIndex + 1}...
              </p>
            </div>
          )}

          {allServersDown && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#11131A]/95 z-50 flex-col gap-4 text-center p-4">
              <span className="text-4xl">📡</span>
              <div className="text-red-400 font-bold tracking-wide">
                Stream Currently Unavailable
              </div>
              <button
                onClick={() => {
                  setAllServersDown(false);
                  setActiveStreamIndex(0);
                  currentlyPlayingUrlRef.current = null;
                  clearServerFailures();
                }}
                className="mt-2 bg-[#1C1E2B] border border-gray-700 hover:border-[#00E5FF] text-white px-5 py-2 rounded-full text-xs font-bold"
              >
                Retry Server 1
              </button>
            </div>
          )}

          <video ref={videoRef} autoPlay playsInline preload="auto" muted={false} className="w-full h-full transition-all duration-300 pointer-events-none" />

          <AnimatePresence>
            {showFitToast && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-6 left-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-lg border border-gray-700/50 shadow-xl z-50 flex items-center gap-2 pointer-events-none"
              >
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse" />
                <span className="text-xs md:text-sm font-bold text-white capitalize">
                  {objectFit === 'contain' ? 'Fit to Screen' : objectFit === 'cover' ? 'Zoom (Cropped)' : 'Stretch (Fill)'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {streams && streams.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-4 my-2 border-b border-gray-800/40 items-center">
            <span className="text-gray-400 font-bold text-xs md:text-sm mr-2 whitespace-nowrap uppercase tracking-wider">
              Servers:
            </span>
            {streams.map((stream, index) => {
              const failureRecord = failedServers[index];
              const isFailed = failureRecord && currentTime.getTime() - failureRecord.time < CONFIG.serverBlacklistDuration * Math.pow(2, failureRecord.attempts - 1);
              const serverName = stream.title || currentMatch?.eventInfo.link_names?.[index] || `Server ${index + 1}`;

              return (
                <button
                  key={index}
                  disabled={isFailed}
                  onClick={() => {
                    removeServerFailure(index);
                    setAllServersDown(false);
                    setActiveStreamIndex(index);
                    currentlyPlayingUrlRef.current = null;
                  }}
                  className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border outline-none duration-150 ${
                    activeStreamIndex === index && !allServersDown
                      ? 'bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                      : isFailed
                        ? 'bg-red-900/20 border-red-900/50 text-red-500/50 cursor-not-allowed'
                        : 'bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white'
                  }`}
                >
                  {serverName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .shaka-custom-stretch-btn {
            background: transparent;
            border: none;
            color: white;
            cursor: pointer;
            padding: 5px;
            opacity: 0.8;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .shaka-scrim-container { display: none !important; background: transparent !important; }
        `,
      }} />

      <Script src="https://momrollback.com/f6/83/fb/f683fbd654f692b402785c1c51f998be.js" strategy="lazyOnload" id="adsterra-popunder" />
    </main>
  );
                                }

