'use client';

import { useEffect, useRef, useState } from 'react';
import { PlayerLogsHandle } from '../../../components/PlayerLogs';
import { Stream } from '../types/media';
import { parseClearKeys } from '../drm/parseClearKeys';
import { SafeShakaWrapper } from '../engine/SafePlayer';
import { NetworkManager } from '../engine/NetworkManager';
import { BufferManager } from '../engine/BufferManager';
import { StallDetector } from '../engine/StallDetector';
import { RecoveryManager } from '../engine/RecoveryManager';
import { ServerRanker } from '../engine/ServerRanker';

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
  const animFrameIdRef = useRef<number>(0);
  
  const initInProgressRef = useRef<boolean>(false);
  const isCurrentlyLoadingRef = useRef<boolean>(false);
  const lastTimeRef = useRef<number>(0);

  const [isEngineReady, setIsEngineReady] = useState(false);

  // High-Speed RAF loop to collect raw timestamps seamlessly without blocking the UI thread
  useEffect(() => {
    const trackingLoop = () => {
      if (videoRef.current) {
        lastTimeRef.current = videoRef.current.currentTime;
      }
      animFrameIdRef.current = requestAnimationFrame(trackingLoop);
    };
    animFrameIdRef.current = requestAnimationFrame(trackingLoop);
    return () => cancelAnimationFrame(animFrameIdRef.current);
  }, []);

  // Shaka Adapter core mounting instance lifecycle
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core Engine: Injecting AI-Shield Layered Adapter...', 'info');
        const shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();

        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;
        wrapperRef.current = new SafeShakaWrapper(player);

        // Network Request Filter for sychronizing downstream tokens mapping dynamically
        player.getNetworkingEngine().registerRequestFilter((type: number, request: any) => {
          if (request._patched) return;
          request._patched = true;

          const freshUrl = currentStreamUrl;
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

        player.addEventListener('buffering', (e: any) => setIsBuffering(e.buffering));
        player.addEventListener('error', (event: any) => {
          if (event.detail && [6007, 3016, 3014].includes(event.detail.code)) {
            if (currentStreamUrl) ServerRanker.recordFailure(currentStreamUrl);
            RecoveryManager.handleLayeredRecovery(currentStreamUrl || '', videoRef.current, playerRef.current, wrapperRef.current, loggerRef, safeSwitchServer);
          }
        });

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
  }, [safeSwitchServer, currentStreamUrl, setIsBuffering, videoContainerRef, videoRef, loggerRef]);

  // Stream lifecycle loading manager pipeline execution hook
  useEffect(() => {
    if (!isEngineReady || !wrapperRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;
    let isMounted = true;

    const loadStreamSource = async () => {
      if (isCurrentlyLoadingRef.current) return;
      if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);

      isCurrentlyLoadingRef.current = true;
      setIsBuffering(true);
      const startTime = Date.now();

      try {
        const currentStream = streams[activeStreamIndex];
        const clearKeysObj = parseClearKeys(currentStream?.api);

        wrapperRef.current?.safeConfigure({ drm: { clearKeys: Object.keys(clearKeysObj).length > 0 ? clearKeysObj : {} } });

        let mimeType = getMimeType(currentStreamUrl.split('|')[0]);
        if (currentStreamUrl.split('|')[0].endsWith('.mpd')) mimeType = 'application/dash+xml';

        await wrapperRef.current?.safeLoad(currentStreamUrl, mimeType);

        if (videoRef.current && isMounted) {
          await videoRef.current.play().catch(() => {
            setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 1000);
          });
          ServerRanker.recordSuccess(currentStreamUrl, (Date.now() - startTime) / 1000);
        }

        if (isMounted) setIsBuffering(false);

        // 🎯 PRODUCTION 1000ms HIGH-SPEED LIGHTWEIGHT WATCHDOG LOOP
        coreWatchdogRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video || !playerRef.current) return;

          // 1. Core Network AI Analytics Engine Execution
          NetworkManager.applySmartABREngine(wrapperRef.current, playerRef.current, loggerRef);

          // 2. DASH MPD advancement validation checks
          const isManifestAdvancing = BufferManager.checkManifestAdvancement(playerRef.current, loggerRef);
          if (!isManifestAdvancing) {
            RecoveryManager.handleLayeredRecovery(currentStreamUrl, video, playerRef.current, wrapperRef.current, loggerRef, safeSwitchServer);
            return;
          }

          // 3. Stalling system analytical evaluations
          const isStalled = StallDetector.checkIsStalled(video, lastTimeRef.current, playerRef.current);
          if (isStalled) {
            ServerRanker.recordStall(currentStreamUrl);
            RecoveryManager.handleLayeredRecovery(currentStreamUrl, video, playerRef.current, wrapperRef.current, loggerRef, safeSwitchServer);
          } else {
            RecoveryManager.clearTracker(currentStreamUrl);
          }
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
