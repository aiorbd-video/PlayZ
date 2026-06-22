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

// 🎯 Better DRM Parsing Helper (ক্লিন এবং সলিড অবজেক্ট পার্সার)
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

  // ১. প্লেয়ার ও ইউআই ওয়ান-টাইম ইনিশিয়ালাইজেশন (ব্রাউজার লাইফসাইকেলে শুধু একবার হবে)
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

        // 🎯 প্রফেশনাল IPTV & DASH লাইভ স্ট্রিমিং কনফিগারেশন
        player.configure({
          streaming: {
            bufferingGoal: 12,
            rebufferingGoal: 2,
            bufferBehind: 20,
            stallEnabled: false, // DASH timeline jump ফিক্স করতে অফ রাখা হয়েছে
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
              autoCorrectDrift: true // DASH লাইভ স্ট্রিম সিঙ্ক ঠিক রাখার জন্য
            }
          }
        });

        // 🎯 মেমোরি লিক ফিক্স (Proper Listener Management)
        const onBuffering = (e: any) => setIsBuffering(e.buffering);

        const onError = async (event: any) => {
          const error = event.detail;
          const switchCodes = [1001, 1002, 6007, 3016];

          if (switchCodes.includes(error.code)) {
            loggerRef.current?.addLog(`Fatal Error ${error.code}. Switching server...`, 'error');
            safeSwitchServer();
          } else {
            loggerRef.current?.addLog(`Recoverable/Ignored Error ${error.code}`, 'warn');
          }
        };

        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);

        // আনমাউন্ট করার সময় ক্লিনআপ লিসেনার স্টোর করা হলো
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

  // ২. স্ট্রিম লোড রানার (সার্ভার সোয়াপ ইঞ্জিন)
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
        
        // 🎯 ২০ সেকেন্ডের সেফ লোড টাইমাউট লিমিট (Promise Race)
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

        // 🎯 স্মার্ট কাস্টম স্টল ডিটেকশন লজিক (DASH ফ্রেম ফ্রিজ প্রটেকশন)
        if (stallIntervalRef.current) clearInterval(stallIntervalRef.current);
        let lastTime = 0;
        let stallCount = 0;
        
        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;
          
          const diff = Math.abs(video.currentTime - lastTime);
          
          if (!video.paused && !video.seeking && diff < 0.05) {
            stallCount++;
            loggerRef.current?.addLog(`Stall warning ${stallCount}/3...`, 'warn');
          } else {
            stallCount = 0;
          }

          if (stallCount >= 3) {
            loggerRef.current?.addLog('Playback stall confirmed. Switching...', 'error');
            safeSwitchServer();
          }
          
          lastTime = video.currentTime;
        }, 5000); // প্রতি ৫ সেকেন্ডে চেক করবে, টানা ১৫ সেকেন্ড ফ্রিজ থাকলে তবেই সুইচ করবে

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
