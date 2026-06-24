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

export function useShakaEngine(props: UseShakaEngineProps) {
  const {
    currentStreamUrl, activeStreamIndex, streams, allServersDown,
    videoRef, videoContainerRef
  } = props;

  // 🎯 ফিক্স ১: Re-render Loop বন্ধ করতে ফাংশনগুলোকে Ref এর ভেতর রাখা হলো
  const callbacks = useRef({
    safeSwitchServer: props.safeSwitchServer,
    setIsBuffering: props.setIsBuffering,
    getMimeType: props.getMimeType,
    loggerRef: props.loggerRef,
  });

  // ফাংশনগুলো সবসময় আপডেটেড থাকবে, কিন্তু প্লেয়ার ডিলিট করবে না
  useEffect(() => {
    callbacks.current = {
      safeSwitchServer: props.safeSwitchServer,
      setIsBuffering: props.setIsBuffering,
      getMimeType: props.getMimeType,
      loggerRef: props.loggerRef,
    };
  });

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

  // 🎯 ফিক্স ২: ডিপেন্ডেন্সি অ্যারে থেকে কলব্যাকগুলো সরিয়ে দেওয়া হলো যেন প্লেয়ার মাত্র ১ বারই মাউন্ট হয়
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initInstance = async () => {
      try {
        callbacks.current.loggerRef.current?.addLog('Core Engine: Mounting Secure Modular Stack...', 'info');
        const shaka: any = await import('shaka-player/dist/shaka-player.ui');
        
        if (shaka.polyfill) shaka.polyfill.installAll();

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

        wrapperRef.current.safeAddEventListener(player, 'buffering', (e: any) => {
           callbacks.current.setIsBuffering(e.buffering);
        });
        
        setIsEngineReady(true);
      } catch (err: any) {
        initInProgressRef.current = false;
        callbacks.current.loggerRef.current?.addLog(`Core Mount Failed: ${err.message}`, 'error');
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
  }, [videoContainerRef, videoRef]); 

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
      callbacks.current.setIsBuffering(true);
      const startTime = Date.now();

      try {
        const currentStream = streams[activeStreamIndex];
        const clearKeysObj = parseClearKeys(currentStream?.api);

        wrapperRef.current?.safeConfigure({ drm: { clearKeys: Object.keys(clearKeysObj).length > 0 ? clearKeysObj : {} } });

        let mimeType = callbacks.current.getMimeType(cleanUrlForMime);
        if (cleanUrlForMime.split('?')[0].endsWith('.mpd')) mimeType = 'application/dash+xml';

        lastLoadedIndexRef.current = activeStreamIndex;
        lastLoadedBaseUrlRef.current = cleanBaseUrl;

        const loadPromise = wrapperRef.current?.safeLoad(currentStreamUrl, mimeType);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('30s Load Timeout')), 30000));
        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          try {
            await videoRef.current.play();
            callbacks.current.loggerRef.current?.addLog('Playback live on-screen!', 'success');
            ServerRanker.recordSuccess(currentStreamUrl, (Date.now() - startTime) / 1000);
          } catch {
            setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 1500);
          }
        }

        if (isMounted) callbacks.current.setIsBuffering(false);

        if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);

        StreamBrain.reset();

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
            safeSwitch: callbacks.current.safeSwitchServer,
          });

        }, 1000);

      } catch (err: any) {
        ServerRanker.recordFailure(currentStreamUrl);
        if (isMounted) callbacks.current.safeSwitchServer();
      } finally {
        isCurrentlyLoadingRef.current = false;
      }
    };

    loadStreamSource();
    return () => { isMounted = false; if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current); };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, isEngineReady, streams, videoRef]); 
}
