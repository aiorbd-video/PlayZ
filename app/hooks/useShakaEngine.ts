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

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || allServersDown || !currentStreamUrl || !streams?.length) {
      loggerRef.current?.addLog('Engine: Criteria not met. Waiting for stable variables.', 'warn');
      return;
    }

    let shaka: any;
    let player: any;
    let ui: any;
    let isMounted = true;

    const startStreaming = async () => {
      setIsBuffering(true);
      loggerRef.current?.addLog(`Engine Initializing for Server index: ${activeStreamIndex}`, 'info');
      loggerRef.current?.addLog(`Stream URL Target: ${currentStreamUrl}`, 'info');

      try {
        // ১. ধ্বংস ও পরিচ্ছন্নতা লগ
        if (uiRef.current) {
          loggerRef.current?.addLog('Destroying previous UI Overlay...', 'info');
          uiRef.current.destroy();
          uiRef.current = null;
        }
        if (playerRef.current) {
          loggerRef.current?.addLog('Destroying previous Player Instance...', 'info');
          await playerRef.current.destroy();
          playerRef.current = null;
        }

        // ২. শাকা মডিউল লোড
        loggerRef.current?.addLog('Importing shaka-player UI assets asynchronously...', 'info');
        shaka = await import('shaka-player/dist/shaka-player.ui');
        if (!isMounted) return;
        
        loggerRef.current?.addLog('Installing Shaka Polyfills...', 'info');
        shaka.polyfill.installAll();

        if (!shaka.Player.isBrowserSupported()) {
          loggerRef.current?.addLog('CRITICAL: Shaka Player indicates browser is not supported!', 'error');
          return;
        }

        // ৩. ফ্রেশ ইনস্ট্যান্স ক্রিয়েশন
        loggerRef.current?.addLog('Constructing brand new Shaka Player instance...', 'info');
        player = new shaka.Player(videoRef.current);
        playerRef.current = player;

        loggerRef.current?.addLog('Constructing Shaka UI Overlay Configuration...', 'info');
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'fullscreen'],
          addSeekBar: true,
        });

        player.configure({
          streaming: {
            bufferingGoal: 10,
            rebufferingGoal: 1,
            bufferBehind: 15,
            startAtSegmentBoundary: true,
            jumpLargeGaps: true,
            retryParameters: { maxAttempts: 5, baseDelay: 400, timeout: 8000 }
          }
        });

        // ৪. লিসেনার এটাচমেন্ট ও বাফারিং ট্র্যাকিং
        player.addEventListener('buffering', (e: any) => {
          if (isMounted) {
            setIsBuffering(e.buffering);
            loggerRef.current?.addLog(`Player state changed: Buffering = ${e.buffering}`, 'warn');
          }
        });

        player.addEventListener('error', (event: any) => {
          if (isMounted) {
            const error = event.detail;
            loggerRef.current?.addLog(`Shaka Player Error Caught! Code: ${error.code}, Category: ${error.category}`, 'error');
            safeSwitchServer();
          }
        });

        // ৫. DRM ক্লীয়ার-কী রিয়্যাকশন লগ
        const currentStream = streams[activeStreamIndex];
        const newDrmApi = currentStream?.api || '';
        const clearKeysObj: Record<string, string> = {};
        let parsedData: any = newDrmApi;

        loggerRef.current?.addLog(`Inspecting DRM configuration string: ${JSON.stringify(newDrmApi)}`, 'info');

        if (typeof newDrmApi === 'string' && newDrmApi.trim().startsWith('{')) {
          try { parsedData = JSON.parse(newDrmApi.trim()); } catch (e) {
            loggerRef.current?.addLog('DRM: Failed to parse API JSON string.', 'warn');
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
          loggerRef.current?.addLog(`Injecting extracted ClearKeys DRM parameters: ${JSON.stringify(clearKeysObj)}`, 'success');
          player.configure({ drm: { clearKeys: clearKeysObj } });
        } else {
          loggerRef.current?.addLog('No DRM ClearKeys detected for this source. Proceeding without DRM.', 'info');
        }

        // ৬. লেয়ার সোর্স লোডিং ও প্লেব্যাক টেস্ট
        const mimeType = getMimeType(currentStreamUrl);
        loggerRef.current?.addLog(`Calculated manifest MimeType: ${mimeType || 'Auto-Detect'}`, 'info');
        
        loggerRef.current?.addLog('Invoking player.load(). Waiting for response async...', 'info');
        await player.load(currentStreamUrl, null, mimeType);
        
        loggerRef.current?.addLog('Manifest asset loaded successfully into engine!', 'success');
        
        if (videoRef.current && isMounted) {
          loggerRef.current?.addLog('Triggering native HTML5 video.play()...', 'info');
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Playback started actively!', 'success'))
            .catch((pErr) => loggerRef.current?.addLog(`Browser Playback Blocked/Delayed: ${pErr.message}`, 'warn'));
        }
        
        if (isMounted) setIsBuffering(false);

      } catch (err: any) {
        loggerRef.current?.addLog(`Critical Crash inside startStreaming: ${err.message || err}`, 'error');
        if (isMounted) safeSwitchServer();
      }
    };

    startStreaming();

    return () => {
      loggerRef.current?.addLog('Effect cleanup triggered. Dismounting stream context.', 'warn');
      isMounted = false;
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams]);

  // হার্ড ক্লিনিং যখন ইউজার পেজ থেকে বের হয়ে যাবে
  useEffect(() => {
    return () => {
      if (uiRef.current) { uiRef.current.destroy(); }
      if (playerRef.current) { playerRef.current.destroy(); }
    };
  }, []);
    }
