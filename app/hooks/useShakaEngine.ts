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

// 🎯 ৬. Better DRM Parsing Helper
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

        // 🎯 ৩ ও ৯. Low Latency & Live IPTV Config
        player.configure({
          streaming: {
            bufferingGoal: 8,
            rebufferingGoal: 1,
            bufferBehind: 10,
            inaccurateManifestTolerance: 0,
            stallEnabled: true,
            stallThreshold: 2,
            stallSkip: 0.1,
            retryParameters: { maxAttempts: 3, baseDelay: 1000 }
          },
          abr: {
            enabled: true,
            switchInterval: 3,
          }
        });

        // 🎯 ৪. Networking Filter
        const netEngine = player.getNetworkingEngine();
        if (netEngine) {
          netEngine.registerRequestFilter((type: any, request: any) => {
            request.allowCrossSiteCredentials = true;
            try {
              if (navigator.userAgent) {
                request.headers['User-Agent'] = navigator.userAgent;
              }
            } catch (e) {
              // Some browsers block modifying User-Agent header
            }
          });
        }

        // 🎯 ৭. Memory Leak Fix (Proper Listener Management)
        const onBuffering = (e: any) => setIsBuffering(e.buffering);

        // 🎯 ১ ও ৫. Smart Error Handler & Auto Recover
        const onError = async (event: any) => {
          const error = event.detail;
          const switchCodes = [1001, 1002, 6007, 3016];

          if (switchCodes.includes(error.code)) {
            loggerRef.current?.addLog(`Fatal Error ${error.code}, attempting recovery...`, 'error');
            try {
              const recovered = await player.retryStreaming();
              if (recovered) {
                loggerRef.current?.addLog(`Stream auto-recovered after error ${error.code}!`, 'success');
                return;
              }
            } catch (retryErr) {
               loggerRef.current?.addLog(`Recovery failed. Switching server...`, 'warn');
            }
            safeSwitchServer();
          } else {
            loggerRef.current?.addLog(`Recoverable/Ignored Error ${error.code}`, 'warn');
          }
        };

        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);

        // Store cleanup function on the player instance for easy unmounting
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

  // ২. স্ট্রিম এবং DRM লোড রানার
  useEffect(() => {
    if (!playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;

    let isMounted = true;

    const loadStreamSource = async () => {
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
        
        // 🎯 ৮. Fast Server Failover (10s Timeout)
        const loadPromise = playerRef.current.load(currentStreamUrl, null, mimeType);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('10s Load Timeout Limit Reached')), 10000)
        );

        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Playback live on-screen!', 'success'))
            .catch(() => loggerRef.current?.addLog('Autoplay deferred. Waiting for interaction.', 'warn'));
        }

        if (isMounted) setIsBuffering(false);

        // 🎯 ২. Stall Detection (Starts only after successful load)
        if (stallIntervalRef.current) clearInterval(stallIntervalRef.current);
        let lastTime = 0;
        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;
          if (!video.paused && !video.seeking && video.currentTime === lastTime) {
            loggerRef.current?.addLog('Playback stall detected (frozen frame)', 'error');
            safeSwitchServer();
          }
          lastTime = video.currentTime;
        }, 15000);

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
      if (stallIntervalRef.current) clearInterval(stallIntervalRef.current);
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams]);
}
