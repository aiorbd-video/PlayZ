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
  
  const initInProgressRef = useRef<boolean>(false);
  const isCurrentlyLoadingRef = useRef<boolean>(false);
  
  // 🎯 ফিক্স ২: আরএএফ রিমুভড, পিউর ১ সেকেন্ড রেজোলিউশন ওয়াচডগ প্রিভিয়াস রেফারেন্স
  const previousTimeRef = useRef<number>(0);
  
  // 🎯 ফিক্স ১: ক্লোজার বাগ এবং মাউন্ট টাইমের ওল্ড ইউআরএল লক ভাঙার জন্য লেটেস্ট ইউআরএল রেফ
  const latestStreamUrlRef = useRef<string | null>(null);
  const lastLoadedIndexRef = useRef<number | null>(null);
  const lastLoadedBaseUrlRef = useRef<string | null>(null);

  const [isEngineReady, setIsEngineReady] = useState(false);

  // প্রতি চেঞ্জে সাইলেন্টলি লেটেস্ট ইউআরএল সিঙ্ক রাখা হচ্ছে
  useEffect(() => { 
    latestStreamUrlRef.current = currentStreamUrl; 
  }, [currentStreamUrl]);

  // শাকা মাউন্টিং অ্যাডাপ্টার লেয়ার
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core Engine: Mounting Secure Modular Stack...', 'info');
        const shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();

        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;
        wrapperRef.current = new SafeShakaWrapper(player);

        // রিকোয়েস্ট ফিল্টারে ক্লোজার বাগ ফিক্সড (ইউআরএল চেঞ্জ হলে ইনস্ট্যান্ট রেফ আপডেট পাবে)
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

        // 🎯 ফিক্স ৫: মেমোরি লিক আটকাতে wrapper.safeAddEventListener ব্যবহার
        wrapperRef.current.safeAddEventListener(player, 'buffering', (e: any) => setIsBuffering(e.buffering));
        wrapperRef.current.safeAddEventListener(player, 'error', (event: any) => {
          if (event.detail && [6007, 3016, 3014].includes(event.detail.code)) {
            if (latestStreamUrlRef.current) ServerRanker.recordFailure(latestStreamUrlRef.current);
            RecoveryManager.handleLayeredRecovery(15, videoRef.current, playerRef.current, wrapperRef.current, loggerRef, safeSwitchServer);
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
  }, [safeSwitchServer, setIsBuffering, videoContainerRef, videoRef, loggerRef]);

  // সোর্স লোডার এবং ১ সেকেন্ড হাই-রেজোলিউশন ওয়াচডগ ট্র্যাকার লুপ
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

        // 🎯 ফিক্স ৭: ৩০ সেকেন্ডের প্রোডাকশন লোড টাইমআউট লিমিট রেস রেস্টোরড
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

        let stallCount = 0;
        if (coreWatchdogRef.current) clearInterval(coreWatchdogRef.current);

        // 🎯 প্রোডাকশন ১ সেকেন্ড (1000ms) লাইটওয়েট ওয়াচডগ ব্যবধান
        coreWatchdogRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video || !playerRef.current) return;

          // ১. নেটওয়ার্ক অ্যাডাপ্টেশন এস্টিমেটর
          NetworkManager.applySmartABREngine(wrapperRef.current, playerRef.current, loggerRef);

          // ২. এমপিডি লাইভ ম্যানিফেস্ট ফ্রিজ কন্ট্রোলার ট্র্যাকিং
          const isManifestAdvancing = BufferManager.checkManifestAdvancement(video, playerRef.current, loggerRef);
          if (!isManifestAdvancing) {
            stallCount = 15; // Force failover condition for broken manifest timelines
            ServerRanker.recordFailure(currentStreamUrl);
            RecoveryManager.handleLayeredRecovery(stallCount, video, playerRef.current, wrapperRef.current, loggerRef, safeSwitchServer);
            return;
          }

          // ৩. পিউর ওয়াচডগ প্রিভিয়াস রেফারেন্স ফিল্টার চেক
          const prevTime = previousTimeRef.current;
          const isStalled = StallDetector.checkIsStalled(video, prevTime, playerRef.current);

          if (isStalled) {
            stallCount++;
            ServerRanker.recordStall(currentStreamUrl);
            loggerRef.current?.addLog(`Watchdog Alert: Core Lagged. Level [${stallCount}/15]`, 'warn');
            
            // ৪. ৫-স্তরের প্রগ্রেসিভ লেয়ারড রিকভারি এক্সিকিউশন
            RecoveryManager.handleLayeredRecovery(stallCount, video, playerRef.current, wrapperRef.current, loggerRef, safeSwitchServer);
          } else {
            // ফ্লিপ-ফ্লপ বাস্ট রুখতে স্মুথ ডিক্রিজ মেকানিজম
            stallCount = Math.max(0, stallCount - 1);
          }

          previousTimeRef.current = video.currentTime;
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
