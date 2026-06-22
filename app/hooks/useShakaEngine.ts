'use client';

import { useEffect, useRef } from 'react';
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

// 🎯 Better DRM Parsing Helper
const parseClearKeys = (drmData: string | object | undefined): Record<string, string> => {
  if (!drmData) return {};
  try {
    let data = typeof drmData === 'string' ? drmData.trim() : drmData;
    if (typeof data === 'string' && data.startsWith('{')) {
      data = JSON.parse(data);
    }
    if (typeof data === 'object' && data !== null) {
      return Object.fromEntries(
        Object.entries(data)
          .map(([kid, key]) => [
            kid.replace(/['"\s{}:]/g, ''),
            String(key).replace(/['"\s{}:]/g, '')
          ])
          .filter(([kid, key]) => kid && key)
      );
    }
    if (typeof data === 'string' && data.includes(':')) {
      const parts = data.replace(/['"\s{}]/g, '').split(':');
      if (parts.length === 2) return { [parts[0]]: parts[1] };
    }
    return {};
  } catch {
    return {};
  }
};

export function useShakaEngine({
  currentStreamUrl,
  activeStreamIndex,
  streams,
  allServersDown,
  videoRef,
  videoContainerRef,
  loggerRef,
  setIsBuffering,
  safeSwitchServer,
  getMimeType,
}: UseShakaEngineProps) {
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const playerInitRef = useRef<boolean>(false);
  const stallIntervalRef = useRef<any>(null);

  // ১. প্লেয়ার ও ইউআই ওয়ান-টাইম ইনিশিয়ালাইজেশন
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || playerInitRef.current) return;
    playerInitRef.current = true;

    let shaka: any;
    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core: Creating pristine Shaka Instance...', 'info');
        shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();

        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        const ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen'],
          addSeekBar: true,
        });

        player.configure({
          streaming: {
            bufferingGoal: 12,
            rebufferingGoal: 2,
            bufferBehind: 20,
            stallEnabled: false, 
            retryParameters: {
              maxAttempts: 5,
              baseDelay: 1000,
              backoffFactor: 2
            }
          },
          abr: {
            enabled: true,
            switchInterval: 8
          },
          manifest: {
            dash: {
              autoCorrectDrift: true 
            }
          }
        });

        const netEngine = player.getNetworkingEngine();
        if (netEngine) {
          netEngine.registerRequestFilter((type: any, request: any) => {
            request.allowCrossSiteCredentials = true;
            try {
              if (navigator.userAgent) {
                request.headers['User-Agent'] = navigator.userAgent;
              }
            } catch (e) {}
          });
        }

        const onBuffering = (e: any) => setIsBuffering(e.buffering);

        // 🎯 Error Handler with Grace Period for 1001
        const onError = async (event: any) => {
          const error = event.detail;

          if (error.code === 1001) {
            loggerRef.current?.addLog(`Network Error 1001. Waiting 3s grace period...`, 'warn');
            setTimeout(() => {
              // ৩ সেকেন্ড পর যদি প্লেয়ার আনমাউন্ট না হয়ে থাকে, তবেই সুইচ করবে
              if (playerRef.current) safeSwitchServer();
            }, 3000);
          } else if ([1002, 6007, 3016].includes(error.code)) {
            loggerRef.current?.addLog(`Fatal Error ${error.code}. Switching immediately...`, 'error');
            safeSwitchServer();
          } else {
            loggerRef.current?.addLog(`Recoverable Error ${error.code} (Ignored)`, 'warn');
          }
        };

        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);

        playerRef.current.__cleanupListeners = () => {
          player.removeEventListener('buffering', onBuffering);
          player.removeEventListener('error', onError);
        };

        loggerRef.current?.addLog('Live IPTV Engine Mounted successfully!', 'success');
      } catch (err) {
        playerInitRef.current = false;
        loggerRef.current?.addLog('Core Mount Failed!', 'error');
      }
    };

    initInstance();

    return () => {
      playerInitRef.current = false;
      if (playerRef.current && playerRef.current.__cleanupListeners) {
        playerRef.current.__cleanupListeners();
      }
      if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [safeSwitchServer]);

  // ২. স্ট্রিম লোড রানার
  useEffect(() => {
    if (!playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;

    let isMounted = true;

    const loadStreamSource = async () => {
      // 🎯 Timer Leak Fix: লোড শুরুর আগেই পুরোনো স্টল ইন্টারভাল খতম!
      if (stallIntervalRef.current) {
        clearInterval(stallIntervalRef.current);
        stallIntervalRef.current = null;
      }

      setIsBuffering(true);
      loggerRef.current?.addLog(`Loading Source: Server [${activeStreamIndex + 1}]`, 'info');

      try {
        await playerRef.current.unload();

        const currentStream = streams[activeStreamIndex];
        const clearKeysObj = parseClearKeys(currentStream?.api);

        if (Object.keys(clearKeysObj).length > 0) {
          loggerRef.current?.addLog(`DRM Keys Parsed & Injected`, 'success');
          playerRef.current.configure({ drm: { clearKeys: clearKeysObj } });
        } else {
          playerRef.current.configure({ drm: { clearKeys: {} } });
        }

        const mimeType = getMimeType(currentStreamUrl);
        
        const loadPromise = playerRef.current.load(currentStreamUrl, null, mimeType);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('20s Load Timeout Limit Reached')), 20000)
        );

        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Playback live on-screen!', 'success'))
            .catch(() => loggerRef.current?.addLog('Autoplay deferred. Waiting for interaction.', 'warn'));
        }

        if (isMounted) setIsBuffering(false);

        // 🎯 Advanced Stall Detection (ReadyState + Buffered Range Check)
        let lastTime = 0;
        let stallCount = 0;
        
        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;

          // Buffer Ahead ক্যালকুলেশন
          const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
          const bufferAhead = buffered - video.currentTime;

          const diff = video.currentTime - lastTime;
          
          if (
            video.readyState >= 3 &&
            !video.paused &&
            !video.seeking &&
            diff < 0.01 &&
            bufferAhead < 10 // 🎯 বাফার ১০ সেকেন্ডের বেশি থাকলে স্টল কাউন্ট স্কিপ!
          ) {
            stallCount++;
            loggerRef.current?.addLog(`Stall warning ${stallCount}/3 (Buffer: ${bufferAhead.toFixed(1)}s)...`, 'warn');
          } else {
            stallCount = 0;
          }

          if (stallCount >= 3) {
            loggerRef.current?.addLog('Playback stall confirmed. Switching...', 'error');
            safeSwitchServer();
          }
          
          lastTime = video.currentTime;
        }, 5000);

      } catch (err: any) {
        if (err.code === 7000 || err.code === 7002) {
          loggerRef.current?.addLog(`Load Interrupted (${err.code}). Ignored.`, 'info');
          return;
        }
        loggerRef.current?.addLog(`Loading Failed: ${err.message || err.code}`, 'error');
        if (isMounted) safeSwitchServer();
      }
    };

    const delayTimer = setTimeout(() => {
      loadStreamSource();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
      if (stallIntervalRef.current) {
        clearInterval(stallIntervalRef.current);
        stallIntervalRef.current = null;
      }
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams]);
}
