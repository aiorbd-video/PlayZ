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

        player.configure({
          streaming: {
            bufferingGoal: 15,
            rebufferingGoal: 2,
            bufferBehind: 20,
            retryParameters: { maxAttempts: 5, baseDelay: 1000 }
          }
        });

        player.addEventListener('buffering', (e: any) => {
          setIsBuffering(e.buffering);
          loggerRef.current?.addLog(`Engine Status: Buffering = ${e.buffering}`, 'warn');
        });

        player.addEventListener('error', (event: any) => {
          loggerRef.current?.addLog(`Critical Player Error Code: ${event.detail?.code}`, 'error');
          safeSwitchServer();
        });

        loggerRef.current?.addLog('Core Engine Mounted and Ready successfully!', 'success');
      } catch (err) {
        playerInitRef.current = false;
        loggerRef.current?.addLog('Core Mount Failed!', 'error');
      }
    };

    initInstance();

    return () => {
      playerInitRef.current = false;
      if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [safeSwitchServer]);

  // ২. স্ট্রিম এবং DRM লোড রানার (সার্ভার চেঞ্জ হলে রিলোভ হবে না, শুধু সোর্স সোয়াইপ হবে)
  useEffect(() => {
    if (!playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;

    let isMounted = true;

    const loadStreamSource = async () => {
      setIsBuffering(true);
      loggerRef.current?.addLog(`Loading Stream Source for Index [${activeStreamIndex}]`, 'info');

      try {
        // প্লেয়ারকে খালি করা (Unload)
        await playerRef.current.unload();

        // অরিজিনাল শক্তিশালী DRM ক্লীয়ার-কী পার্সার
        const currentStream = streams[activeStreamIndex];
        const drmData = currentStream?.api || '';
        const clearKeysObj: Record<string, string> = {};
        let parsedData: any = drmData;

        if (typeof drmData === 'string') {
          const trimmed = drmData.trim();
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
          const parts = parsedData.replace(/['"\s{}]/g, '').split(':');
          if (parts.length === 2) clearKeysObj[parts[0]] = parts[1];
        }

        if (Object.keys(clearKeysObj).length > 0) {
          loggerRef.current?.addLog(`Injecting DRM Keys: ${JSON.stringify(clearKeysObj)}`, 'success');
          playerRef.current.configure({ drm: { clearKeys: clearKeysObj } });
        } else {
          playerRef.current.configure({ drm: { clearKeys: {} } });
        }

        const mimeType = getMimeType(currentStreamUrl);
        loggerRef.current?.addLog(`Manifest Type: ${mimeType || 'Auto-Mime'}`, 'info');

        // সোর্স লোড করা
        await playerRef.current.load(currentStreamUrl, null, mimeType);
        loggerRef.current?.addLog('Source injected successfully into HTML5 Video Pipeline!', 'success');

        if (videoRef.current && isMounted) {
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Video is actively rendering on-screen!', 'success'))
            .catch((e) => loggerRef.current?.addLog(`Autoplay deferred: ${e.message}`, 'warn'));
        }

        if (isMounted) setIsBuffering(false);
      } catch (err: any) {
        loggerRef.current?.addLog(`Source Loading Failed: ${err.message || err.code}`, 'error');
        if (isMounted) safeSwitchServer();
      }
    };

    // ৫ মিলিসেকেন্ডের একটা ম্যাক্রো বাফার দেওয়া হলো ডম রিসেটের জন্য
    const delayTimer = setTimeout(() => {
      loadStreamSource();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams]);
}
