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
            
            // 🎯 ফিক্স ৩: DASH/MPD সেগমেন্টে বাফার লুপ নষ্ট করা এড়াতে লাইভ রানিংয়ে P2P ইনজেকশন সাময়িকভাবে স্কিপ করা হলো
            // p2pEngineRef.current.initShakaPlayer(player);
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

        // 🎯 ফিক্স ২ এবং ৭: বড় স্ক্রিন/টিভি ব্রাউজার এবং ব্রোকেন প্রোফাইল এড়াতে বাফার গোল বাড়ানো ও ABR ডিজেবল করা হলো
        player.configure({
          streaming: {
            bufferingGoal: 15, 
            rebufferingGoal: 5, 
            liveSyncDuration: 10, 
            bufferBehind: 30, 
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
            // 🎯 ফিক্স ৪: ১০০১ এবং ১০০২ কোডকে ফ্যাটাল লিস্ট থেকে বাদ দেওয়া হলো
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

        // 🎯 ফিক্স ৫: ডাইরেক্ট এক্সটেনশন রিড করে MPD/DASH টাইপ ফোর্সলি ইনজেক্ট করা হলো
        let mimeType = getMimeType(cleanUrlForMime);
        if (cleanUrlForMime.includes('.mpd')) {
          mimeType = 'application/dash+xml';
        }

        lastLoadedIndexRef.current = activeStreamIndex;
        lastLoadedBaseUrlRef.current = cleanBaseUrl;

        const loadPromise = playerRef.current.load(currentStreamUrl, null, mimeType);
        
        // 🎯 ফিক্স ৬: লোড টাইমআউট লিমিট ২০ সেকেন্ড থেকে বাড়িয়ে ৩০ সেকেন্ড (30000ms) করা হলো
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('30s Load Timeout Limit Reached')), 30000));

        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Playback live on-screen!', 'success'))
            .catch(() => loggerRef.current?.addLog('Autoplay deferred. Waiting for interaction.', 'warn'));
        }

        if (isMounted) setIsBuffering(false);

        let lastTime = 0;
        let stallCount = 0;
        
        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;

          const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
          const bufferAhead = buffered - video.currentTime;
          const diff = video.currentTime - lastTime;
          
          // 🎯 ফিক্স ১ এবং প্রধান ফিক্স: স্টল ডিটেকশন লজিক আল্ট্রা-রিল্যাক্সড করা হলো (TV ও PC ফ্রেন্ডলি)
          if (video.readyState < 2 || (diff < 0.01 && bufferAhead < 2)) {
            stallCount++;
            loggerRef.current?.addLog(`Stall tracking ${stallCount}/6 (Buffer: ${bufferAhead.toFixed(1)}s)...`, 'warn');
          } else {
            stallCount = 0;
          }

          // ৩ বারের বদলে ৬ বার ট্রিগার এবং জেনুইন readyState ল্যাক চেক করে রিলোড হবে
          if (stallCount >= 6 && video.readyState < 2) {
            loggerRef.current?.addLog('Playback stall confirmed natively. Switching...', 'error');
            safeSwitchServer();
          }
          lastTime = video.currentTime;
        }, 5000);

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
