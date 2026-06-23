'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayerLogsHandle } from '../components/PlayerLogs';

interface UseShakaEngineProps {
  currentStreamUrl: string | null;
  activeStreamIndex: number;
  streams: any[] | null;
  allServersDown: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  loggerRef: React.RefObject<PlayerLogsHandle | null>;
  setIsBuffering: (b: boolean) => void;
  safeSwitchServer: () => void;
  getMimeType: (url: string) => string | undefined;
}

const parseClearKeys = (drmData: string | object | undefined): Record<string, string> => {
  if (!drmData) return {};
  try {
    let data = typeof drmData === 'string' ? drmData.trim() : drmData;
    if (typeof data === 'string' && data.startsWith('{')) { data = JSON.parse(data); }
    if (typeof data === 'object' && data !== null) {
      return Object.fromEntries(
        Object.entries(data).map(([kid, key]) => [
          kid.replace(/['"\s{}:]/g, ''), String(key).replace(/['"\s{}:]/g, '')
        ]).filter(([kid, key]) => kid && key)
      );
    }
    if (typeof data === 'string' && data.includes(':')) {
      const parts = data.replace(/['"\s{}]/g, '').split(':');
      if (parts.length === 2) return { [parts[0]]: parts[1] };
    }
    return {};
  } catch { return {}; }
};

export function useShakaEngine({
  currentStreamUrl, activeStreamIndex, streams, allServersDown,
  videoRef, videoContainerRef, loggerRef, setIsBuffering, safeSwitchServer, getMimeType,
}: UseShakaEngineProps) {
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const p2pEngineRef = useRef<any>(null);
  const stallIntervalRef = useRef<any>(null);
  const initInProgressRef = useRef<boolean>(false);
  const isCurrentlyLoadingRef = useRef<boolean>(false);

  const latestStreamUrlRef = useRef<string | null>(null);
  const lastLoadedIndexRef = useRef<number | null>(null);
  const lastLoadedBaseUrlRef = useRef<string | null>(null);
  const lastSwitchRef = useRef<number>(0);

  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => {
    latestStreamUrlRef.current = currentStreamUrl;
  }, [currentStreamUrl]);

  // ১. প্লেয়ার ও ইউআই ওয়ান-টাইম ইনিশিয়ালাইজেশন
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || initInProgressRef.current) return;
    initInProgressRef.current = true;

    let shaka: any;
    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core: Creating pristine Shaka Instance...', 'info');
        
        shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();

        let P2PEngine: any = null;
        try {
          const p2pModule: any = await import('p2p-media-loader-shaka');
          P2PEngine = p2pModule.Engine || p2pModule.default?.Engine; 
        } catch (p2pErr: any) {
          loggerRef.current?.addLog(`P2P Engine skipped: ${p2pErr.message}`, 'warn');
        }

        if (shaka.ui.Controls && !(shaka.ui.Controls as any).custom_stretch_registered) {
          class StretchButton extends shaka.ui.Element {
            constructor(parent: HTMLElement, controls: any) {
              super(parent, controls);
              const button = document.createElement('button');
              button.className = 'shaka-custom-stretch-btn shaka-tooltip';
              button.setAttribute('aria-label', 'Toggle Fit');
              button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
              this.eventManager.listen(button, 'click', () => { window.dispatchEvent(new CustomEvent('toggleObjectFit')); });
              parent.appendChild(button);
            }
          }
          shaka.ui.Controls.registerElement('custom_stretch', { create: (root: HTMLElement, ctrls: any) => new StretchButton(root, ctrls) });
          (shaka.ui.Controls as any).custom_stretch_registered = true;
        }

        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        // সাইলেন্ট ব্যাকগ্রাউন্ড টোকেন ইনজেক্টর ফিল্টার
        player.getNetworkingEngine().registerRequestFilter((type: number, request: any) => {
          // 🎯 ফিক্স ৫: PC/TV এর CPU স্পাইক রুখতে রিকোয়েস্ট ওভারহেড প্রটেকশন ফ্ল্যাগ
          if (request._patched) return;
          request._patched = true;

          const freshUrlWithToken = latestStreamUrlRef.current;
          if (!freshUrlWithToken) return;

          const parts = freshUrlWithToken.split('|');
          const tokenUrl = parts[0].trim();

          if (tokenUrl.includes('?')) {
            const freshQueryString = tokenUrl.split('?')[1];
            request.uris = request.uris.map((uri: string) => {
              const baseUri = uri.split('?')[0];
              return `${baseUri}?${freshQueryString}`;
            });
          }

          if (parts.length > 1) {
            const headerPart = parts[1];
            const pairs = headerPart.split('&');
            pairs.forEach((pair) => {
              if (pair.includes('=')) {
                const [k, v] = pair.split('=', 2);
                request.headers[k.trim().toLowerCase()] = v.trim();
              }
            });
          }
        });

        if (P2PEngine && P2PEngine.isSupported && P2PEngine.isSupported()) {
          try {
            p2pEngineRef.current = new P2PEngine({
              segments: { swarmId: currentStreamUrl || 'playz-live-swarm' },
              loader: { cachedSegmentExpiration: 86400000, cachedSegmentsCount: 50 }
            });
            loggerRef.current?.addLog('🚀 P2P Engine Warm-ready (Bypassed for MPD stability)', 'info');
          } catch (e: any) {
            loggerRef.current?.addLog(`P2P setup failed: ${e.message}`, 'warn');
          }
        }

        const ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'overflow_menu', 'fullscreen'],
          addSeekBar: true,
        });

        // 🎯 ফিক্স: ব্রডকাস্ট-গ্রেড টিভি ও পিসি স্ট্যাবিলিটি টিউনিং (Sweet Spot)
        player.configure({
          streaming: {
            bufferingGoal: 20, 
            rebufferingGoal: 7, 
            liveSyncDuration: 6, 
            bufferBehind: 25, 
            stallEnabled: false, 
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2 }
          },
          abr: { enabled: false }, 
          manifest: { 
            dash: { 
              autoCorrectDrift: true,
              ignoreMinBufferTime: true, 
              initialSegmentLimit: 2
            }, 
            hls: { 
              ignoreManifestProgramDateTime: true 
            }
          }
        });

        const onBuffering = (e: any) => setIsBuffering(e.buffering);
        
        const onError = async (event: any) => {
          const error = event.detail;
          if (error && error.severity === 1) return;
          if (error && error.severity === 2) {
            const fatalCodes = [6007, 3016, 3014];
            if (fatalCodes.includes(error.code)) {
              loggerRef.current?.addLog(`Fatal Network/DRM Error ${error.code}. Triggering fallback...`, 'error');
              safeSwitchServer();
            }
          }
        };

        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);

        playerRef.current.__cleanupListeners = () => {
          player.removeEventListener('buffering', onBuffering);
          player.removeEventListener('error', onError);
        };

        loggerRef.current?.addLog('Live IPTV Engine Mounted successfully!', 'success');
        setIsEngineReady(true);

      } catch (err: any) {
        initInProgressRef.current = false;
        loggerRef.current?.addLog(`Core Mount Failed: ${err.message || err}`, 'error');
      }
    };

    initInstance();

    return () => {
      initInProgressRef.current = false;
      setIsEngineReady(false);
      lastLoadedIndexRef.current = null;
      lastLoadedBaseUrlRef.current = null;
      if (stallIntervalRef.current) { clearInterval(stallIntervalRef.current); stallIntervalRef.current = null; }
      if (playerRef.current && playerRef.current.__cleanupListeners) playerRef.current.__cleanupListeners();
      if (p2pEngineRef.current) { p2pEngineRef.current.destroy(); p2pEngineRef.current = null; }
      if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [safeSwitchServer]);

  // ২. স্ট্রিম লোড রানার
  useEffect(() => {
    if (!isEngineReady || !playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;
    
    let isMounted = true;

    const loadStreamSource = async () => {
      if (isCurrentlyLoadingRef.current) return;

      const cleanUrlForMime = (currentStreamUrl || '').split('|')[0];
      const cleanBaseUrl = cleanUrlForMime.split('?')[0];

      if (
        lastLoadedIndexRef.current === activeStreamIndex &&
        lastLoadedBaseUrlRef.current === cleanBaseUrl &&
        playerRef.current.getAssetUri()
      ) {
        return;
      }

      if (stallIntervalRef.current) { clearInterval(stallIntervalRef.current); stallIntervalRef.current = null; }

      isCurrentlyLoadingRef.current = true;
      setIsBuffering(true);
      loggerRef.current?.addLog(`Loading Source: Server [${activeStreamIndex + 1}]`, 'info');

      try {
        await playerRef.current.unload();

        if (!streams || !streams[activeStreamIndex]) {
          throw new Error('Target stream metadata is empty');
        }

        const currentStream = streams[activeStreamIndex];
        const clearKeysObj = parseClearKeys(currentStream?.api);

        if (Object.keys(clearKeysObj).length > 0) {
          loggerRef.current?.addLog(`DRM Keys Parsed & Injected`, 'success');
          playerRef.current.configure({ drm: { clearKeys: clearKeysObj } });
        } else {
          playerRef.current.configure({ drm: { clearKeys: {} } });
        }

        let mimeType = getMimeType(cleanUrlForMime);
        if (cleanUrlForMime.split('?')[0].endsWith('.mpd')) {
          mimeType = 'application/dash+xml';
        }

        lastLoadedIndexRef.current = activeStreamIndex;
        lastLoadedBaseUrlRef.current = cleanBaseUrl;

        const loadPromise = playerRef.current.load(currentStreamUrl, null, mimeType);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('30s Load Timeout Limit Reached')), 30000));

        await Promise.race([loadPromise, timeoutPromise]);

        // 🎯 ফিক্স ৩: টিভি ব্রাউজারের অটোপ্লে ডিলে সেফটি বাড়িয়ে ১৫০০ms (1.5s) করা হলো
        if (videoRef.current && isMounted) {
          const tryPlay = async () => {
            if (!videoRef.current) return;
            try {
              await videoRef.current.play();
              loggerRef.current?.addLog('Playback live on-screen!', 'success');
            } catch {
              setTimeout(() => {
                videoRef.current?.play().catch(() => {});
              }, 1500);
            }
          };
          await tryPlay();
        }

        if (isMounted) setIsBuffering(false);

        let lastTime = 0;
        let stallCount = 0;
        
        // 🎯 ফিক্স ৪: ফাস্ট রিম্যাউন্ট মেমোরি লিক এবং ডাবল ইন্টারভাল রিস্ক রুখতে ডিফেনসিভ গার্ড
        if (stallIntervalRef.current) {
          clearInterval(stallIntervalRef.current);
          stallIntervalRef.current = null;
        }

        // 🎯 ফিক্স ১: রেসপন্স রেজোলিউশন টাইম ৫ সেকেন্ড থেকে কমিয়ে ২৫০০ms করা হলো
        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;

          const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
          const bufferAhead = buffered - video.currentTime;
          
          // 🎯 ফিক্স ২: স্যামসাং/এলজি স্মার্ট টিভির ভুল রিডিং রুখতে রিয়ালিস্টিক নেটওয়ার্ক ব্যাড লজিক
          const networkBad = video.readyState === 0 && video.buffered.length === 0;
          
          const isBufferActuallyBad = networkBad || (video.readyState < 2 && bufferAhead < 0.5 && video.currentTime > 0);
          const isPlaybackFrozen = Math.abs(video.currentTime - lastTime) < 0.001;

          if (isBufferActuallyBad || (isPlaybackFrozen && !video.paused && video.readyState < 3)) {
            stallCount++;
            loggerRef.current?.addLog(`Stall Watchdog: ${stallCount}/6 (Buffer: ${bufferAhead.toFixed(2)}s)`, 'warn');
          } else {
            // 🎯 ফিক্স ৬: ফ্লিপ-ফ্লপ বা হুট করে জিরো হওয়া রুখতে স্মুথ ডিক্রিজ মেকানিজম
            stallCount = Math.max(0, stallCount - 1);
          }

          const hasStarted = video.currentTime > 0 || video.readyState >= 3;

          // 🎯 ফিক্স ৪: এন্টি-লুপ গার্ড সিকিউরিটি চেক (৮ সেকেন্ডের ব্যবধান বাধ্যতামুলক)
          if (stallCount >= 6 && hasStarted && (Date.now() - lastSwitchRef.current > 8000)) {
            loggerRef.current?.addLog('Playback stall confirmed natively with anti-loop guard. Switching...', 'error');
            lastSwitchRef.current = Date.now();
            stallCount = 0;
            safeSwitchServer();
          }
          
          lastTime = video.currentTime;
        }, 2500);

      } catch (err: any) {
        if (err.code === 7000 || err.code === 7002) {
          isCurrentlyLoadingRef.current = false;
          return;
        }
        lastLoadedIndexRef.current = null;
        lastLoadedBaseUrlRef.current = null;
        loggerRef.current?.addLog(`Loading Failed: ${err.message || err.code}`, 'error');
        if (isMounted) safeSwitchServer();
      } finally {
        isCurrentlyLoadingRef.current = false;
      }
    };

    const delayTimer = setTimeout(() => {
      loadStreamSource();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
      if (stallIntervalRef.current) { clearInterval(stallIntervalRef.current); stallIntervalRef.current = null; }
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, isEngineReady, streams, safeSwitchServer, getMimeType, setIsBuffering]);
}
