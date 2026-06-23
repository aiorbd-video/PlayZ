'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayerLogsHandle } from '@/app/components/PlayerLogs';
import { Stream, ServerRanker, NetworkAI, StreamBrain } from '../PlayzEngine';
import { parseClearKeys } from '../drm/parseClearKeys';
import { SafeShakaWrapper } from '../engine/SafePlayer';

interface UseShakaEngineProps {
  currentStreamUrl: string | null;
  activeStreamIndex: number;
  streams: Stream[] | null;
  allServersDown: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoContainerRef: React.RefObject<HTMLDivElement | null>;
  loggerRef: React.RefObject<PlayerLogsHandle | null>;
  setIsBuffering: (b: boolean) => void;
  safeSwitchServer: () => void;
  getMimeType: (url: string) => string | undefined;
}

export function useShakaEngine({
  currentStreamUrl, activeStreamIndex, streams, allServersDown,
  videoRef, videoContainerRef, loggerRef, setIsBuffering, safeSwitchServer, getMimeType,
}: UseShakaEngineProps) {
  const wrapperRef = useRef<SafeShakaWrapper | null>(null);
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const coreWatchdogRef = useRef<any>(null);
  
  const initInProgressRef = useRef<boolean>(false);
  const isCurrentlyLoadingRef = useRef<boolean>(false);
  
  const latestStreamUrlRef = useRef<string | null>(null);
  const lastLoadedIndexRef = useRef<number | null>(null);
  const lastLoadedBaseUrlRef = useRef<string | null>(null);

  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => { 
    latestStreamUrlRef.current = currentStreamUrl; 
  }, [currentStreamUrl]);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core Engine: Mounting Secure Modular Stack...', 'info');
        const shaka: any = await import('shaka-player/dist/shaka-player.ui');
        
        if (shaka.polyfill) {
          shaka.polyfill.installAll();
        }

        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;
        wrapperRef.current = new SafeShakaWrapper(player);

        player.getNetworkingEngine().registerRequestFilter((type: number, request: any) => {
          if (request._patched) return;
          request._patched = true;

          const freshUrl = latestStreamUrlRef.current;
          if (!freshUrl) return;

          const parts = freshUrl.split('|');
          if (parts[0].includes('?')) {
            const query = parts[0].split('?')[1];
            request.uris = request.uris.map((uri: string) => `${uri.split('?')[0]}?${query}`);
          }
        });

        const ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;

        wrapperRef.current.safeConfigure({
          streaming: { bufferingGoal: 20, rebufferingGoal: 7, liveSyncDuration: 6, bufferBehind: 25, stallEnabled: false },
          abr: { enabled: false },
          manifest: { dash: { autoCorrectDrift: true, ignoreMinBufferTime: true } }
        });

        wrapperRef.current.safeAddEventListener(player, 'buffering', (e: any) => setIsBuffering(e.buffering));
        
        setIsEngineReady(true);
      } catch (err: any) {
        initInProgressRef.current = false;
        loggerRef.current?.addLog(`Core Mount Failed: ${err.message}`, 'error');
      }
    };

    initInstance();

    return () => {
      initInProgressRef.current = false;
      setIsEngineReady(false);
      if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);
      if (uiRef.current) uiRef.current.destroy();
      if (wrapperRef.current) wrapperRef.current.safeDestroy();
    };
  }, [safeSwitchServer, setIsBuffering, videoContainerRef, videoRef, loggerRef]);

  useEffect(() => {
    if (!isEngineReady || !wrapperRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;
    let isMounted = true;

    const loadStreamSource = async () => {
      if (isCurrentlyLoadingRef.current) return;
      const cleanUrlForMime = currentStreamUrl.split('|')[0];
      const cleanBaseUrl = cleanUrlForMime.split('?')[0];

      if (lastLoadedIndexRef.current === activeStreamIndex && lastLoadedBaseUrlRef.current === cleanBaseUrl && playerRef.current?.getAssetUri()) return;
      if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);

      isCurrentlyLoadingRef.current = true;
      setIsBuffering(true);
      const startTime = Date.now();

      try {
        const currentStream = streams[activeStreamIndex];
        const clearKeysObj = parseClearKeys(currentStream?.api);

        wrapperRef.current?.safeConfigure({ drm: { clearKeys: Object.keys(clearKeysObj).length > 0 ? clearKeysObj : {} } });

        let mimeType = getMimeType(cleanUrlForMime);
        if (cleanUrlForMime.split('?')[0].endsWith('.mpd')) mimeType = 'application/dash+xml';

        lastLoadedIndexRef.current = activeStreamIndex;
        lastLoadedBaseUrlRef.current = cleanBaseUrl;

        const loadPromise = wrapperRef.current?.safeLoad(currentStreamUrl, mimeType);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('30s Load Timeout')), 30000));
        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          try {
            await videoRef.current.play();
            loggerRef.current?.addLog('Playback live on-screen!', 'success');
            ServerRanker.recordSuccess(currentStreamUrl, (Date.now() - startTime) / 1000);
          } catch {
            setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 1500);
          }
        }

        if (isMounted) setIsBuffering(false);

        if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);

        coreWatchdogRef.current = setInterval(() => {
          const video = videoRef.current;
          const player = playerRef.current;
          if (!video || !player) return;

          let stats: any = {};
          try {
            if (typeof player.getStats === 'function') {
              stats = player.getStats() || {};
            }
          } catch {}

          const buffer = video.buffered.length > 0
            ? Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime)
            : 0;

          const bandwidth = stats.estimatedBandwidth || 4000000;

          NetworkAI.push(bandwidth);

          if (buffer < 0.35) {
            ServerRanker.recordStall(currentStreamUrl);
          }

          StreamBrain.update({
            video,
            safeSwitch: safeSwitchServer,
          });

        }, 1000);

      } catch (err: any) {
        ServerRanker.recordFailure(currentStreamUrl);
        if (isMounted) safeSwitchServer();
      } finally {
        isCurrentlyLoadingRef.current = false;
      }
    };

    loadStreamSource();
    return () => { isMounted = false; if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current); };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, isEngineReady, streams, safeSwitchServer, getMimeType, setIsBuffering, videoRef, loggerRef]);
}
