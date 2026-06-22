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
            bufferingGoal: 15,
            rebufferingGoal: 2,
            bufferBehind: 20,
            retryParameters: { maxAttempts: 5, baseDelay: 1000 }
          }
        });

        player.addEventListener('buffering', (e: any) => {
          setIsBuffering(e.buffering);
        });

        // 🎯 ফিক্সড: শুধুমাত্র Critical (Severity 2) এরর হলেই সার্ভার চেঞ্জ হবে
        player.addEventListener('error', (event: any) => {
          const error = event.detail;
          if (error && error.severity === 2) {
            loggerRef.current?.addLog(`Critical Player Error Code: ${error.code}`, 'error');
            safeSwitchServer();
          } else {
            loggerRef.current?.addLog(`Minor Recoverable Error: ${error?.code} (Ignored)`, 'warn');
          }
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

  // ২. স্ট্রিম এবং DRM লোড রানার
  useEffect(() => {
    if (!playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;

    let isMounted = true;

    const loadStreamSource = async () => {
      setIsBuffering(true);
      loggerRef.current?.addLog(`Loading Stream Source for Index [${activeStreamIndex}]`, 'info');

      try {
        await playerRef.current.unload();

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
          loggerRef.current?.addLog(`Injecting DRM Keys...`, 'success');
          playerRef.current.configure({ drm: { clearKeys: clearKeysObj } });
        } else {
          playerRef.current.configure({ drm: { clearKeys: {} } });
        }

        const mimeType = getMimeType(currentStreamUrl);
        await playerRef.current.load(currentStreamUrl, null, mimeType);

        if (videoRef.current && isMounted) {
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Video is actively rendering on-screen!', 'success'))
            .catch((e) => loggerRef.current?.addLog(`Autoplay deferred: Click play to start.`, 'warn'));
        }

        if (isMounted) setIsBuffering(false);
      } catch (err: any) {
        // 🎯 ফিক্সড: Load Interrupted (7000/7002) এরর হলে সার্ভার চেঞ্জ করবে না!
        if (err.code === 7000 || err.code === 7002) {
          loggerRef.current?.addLog(`Load Interrupted (${err.code}). Safe to ignore.`, 'info');
          return;
        }
        
        loggerRef.current?.addLog(`Source Loading Failed: ${err.message || err.code}`, 'error');
        if (isMounted) safeSwitchServer();
      }
    };

    const delayTimer = setTimeout(() => {
      loadStreamSource();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams]);
}
