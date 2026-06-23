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
  const stallIntervalRef = useRef<any>(null);
  const initInProgressRef = useRef<boolean>(false);
  const isCurrentlyLoadingRef = useRef<boolean>(false);

  const latestStreamUrlRef = useRef<string | null>(null);
  const lastLoadedIndexRef = useRef<number | null>(null);
  const lastLoadedBaseUrlRef = useRef<string | null>(null);
  const lastSwitchRef = useRef<number>(0);

  const [isEngineReady, setIsEngineReady] = useState(false);

  useEffect(() => { latestStreamUrlRef.current = currentStreamUrl; }, [currentStreamUrl]);

  // ১. ওয়ান-টাইম প্লেয়ার কোর ইনিশিয়ালাইজেশন
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core: Creating pristine Modular Engine...', 'info');
        const shaka = await import('shaka-player/dist/shaka-player.ui');
        shaka.polyfill.installAll();

        if (shaka.ui.Controls && !(shaka.ui.Controls as any).custom_stretch_registered) {
          class StretchButton extends shaka.ui.Element {
            constructor(parent: HTMLElement, controls: any) {
              super(parent, controls);
              const button = document.createElement('button');
              button.className = 'shaka-custom-stretch-btn shaka-tooltip';
              button.setAttribute('aria-label', 'Toggle Fit');
              button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
              this.eventManager.listen(button, 'click', () => { window.dispatchEvent(new CustomEvent('toggleObjectFit')); });
              parent.appendChild(button);
            }
          }
          shaka.ui.Controls.registerElement('custom_stretch', { create: (root: HTMLElement, ctrls: any) => new StretchButton(root, ctrls) });
          (shaka.ui.Controls as any).custom_stretch_registered = true;
        }

        const player = new shaka.Player(videoRef.current);
        playerRef.current = player;
        wrapperRef.current = new SafeShakaWrapper(player);

        // সাইলেন্ট ব্যাকগ্রাউন্ড টোকেন ইনজেক্টর ফিল্টার
        player.getNetworkingEngine().registerRequestFilter((type: number, request: any) => {
          if (request._patched) return;
          request._patched = true;

          const freshUrlWithToken = latestStreamUrlRef.current;
          if (!freshUrlWithToken) return;

          const parts = freshUrlWithToken.split('|');
          const tokenUrl = parts[0].trim();

          if (tokenUrl.includes('?')) {
            const freshQueryString = tokenUrl.split('?')[1];
            request.uris = request.uris.map((uri: string) => `${uri.split('?')[0]}?${freshQueryString}`);
          }

          if (parts.length > 1) {
            parts[1].split('&').forEach((pair) => {
              if (pair.includes('=')) {
                const [k, v] = pair.split('=', 2);
                request.headers[k.trim().toLowerCase()] = v.trim();
              }
            });
          }
        });

        const ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'overflow_menu', 'fullscreen'],
          addSeekBar: true,
        });

        // ব্রডকাস্ট-গ্রেড সুইট স্পট কনফিগারেশন ইনজেকশন
        wrapperRef.current.safeConfigure({
          streaming: { bufferingGoal: 20, rebufferingGoal: 7, liveSyncDuration: 6, bufferBehind: 25, stallEnabled: false },
          abr: { enabled: false },
          manifest: { dash: { autoCorrectDrift: true, ignoreMinBufferTime: true, initialSegmentLimit: 2 } }
        });

        player.addEventListener('buffering', (e: any) => setIsBuffering(e.buffering));
        player.addEventListener('error', (event: any) => {
          if (event.detail && [6007, 3016, 3014].includes(event.detail.code)) {
            RecoveryManager.handleFatalError(loggerRef, safeSwitchServer);
          }
        });

        setIsEngineReady(true);
      } catch (err: any) {
        initInProgressRef.current = false;
        loggerRef.current?.addLog(`Core Mount Failed: ${err.message || err}`, 'error');
      }
    };

    initInstance();

    return () => {
      initInProgressRef.current = false;
      setIsEngineReady(false);
      if (stallIntervalRef.current) clearInterval(stallIntervalRef.current);
      if (uiRef.current) uiRef.current.destroy();
      if (wrapperRef.current) wrapperRef.current.safeDestroy();
    };
  }, [safeSwitchServer]);

  // ২. লাইভ স্ট্রিম সোর্স লোডার ও ২.৫ সেকেন্ড সাইকেল টাইমার
  useEffect(() => {
    if (!isEngineReady || !wrapperRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;
    let isMounted = true;

    const loadStreamSource = async () => {
      if (isCurrentlyLoadingRef.current) return;
      const cleanUrlForMime = currentStreamUrl.split('|')[0];
      const cleanBaseUrl = cleanUrlForMime.split('?')[0];

      if (lastLoadedIndexRef.current === activeStreamIndex && lastLoadedBaseUrlRef.current === cleanBaseUrl && playerRef.current?.getAssetUri()) return;
      if (stallIntervalRef.current) clearInterval(stallIntervalRef.current);

      isCurrentlyLoadingRef.current = true;
      setIsBuffering(true);
      loggerRef.current?.addLog(`Loading Pipe: Server [${activeStreamIndex + 1}]`, 'info');

      try {
        const currentStream = streams[activeStreamIndex];
        const clearKeysObj = parseClearKeys(currentStream?.api);

        wrapperRef.current?.safeConfigure({ drm: { clearKeys: Object.keys(clearKeysObj).length > 0 ? clearKeysObj : {} } });

        let mimeType = getMimeType(cleanUrlForMime);
        if (cleanUrlForMime.split('?')[0].endsWith('.mpd')) mimeType = 'application/dash+xml';

        lastLoadedIndexRef.current = activeStreamIndex;
        lastLoadedBaseUrlRef.current = cleanBaseUrl;

        const loadPromise = wrapperRef.current?.safeLoad(currentStreamUrl, mimeType);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('30s Timeout')), 30000));
        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          try {
            await videoRef.current.play();
            loggerRef.current?.addLog('Playback live on-screen!', 'success');
          } catch {
            setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 1500);
          }
        }

        if (isMounted) setIsBuffering(false);

        let lastTime = 0;
        let stallCount = 0;

        if (stallIntervalRef.current) clearInterval(stallIntervalRef.current);

        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;

          // ১. লাইভ ব্যান্ডউইথ রিড ও ফেক এবিআর কন্ট্রোল
          NetworkManager.applyFakeABR(wrapperRef.current, playerRef.current);

          // ২. প্রো-অ্যাক্টিভ বাফার অ্যাডাপ্টেশন
          BufferManager.runAdaptiveInflation(video, lastTime, wrapperRef.current);

          // ৩. আল্ট্রা-স্ট্যাবল স্টল ওয়াচডগ কল
          const isStalled = StallDetector.checkIsStalled(video, lastTime);

          if (isStalled) {
            stallCount++;
            loggerRef.current?.addLog(`Shield Watchdog Status: ${stallCount}/6`, 'warn');
          } else {
            stallCount = Math.max(0, stallCount - 1); 
          }

          const hasStarted = video.currentTime > 0 || video.readyState >= 3;
          
          // ৪. এন্টি-লুপ গার্ড সিকিউরিটি চেক (৮ সেকেন্ড লক)
          if (stallCount >= 6 && hasStarted && (Date.now() - lastSwitchRef.current > 8000)) {
            lastSwitchRef.current = Date.now();
            stallCount = 0;
            RecoveryManager.handleFatalError(loggerRef, safeSwitchServer);
          }

          lastTime = video.currentTime;
        }, 2500);

      } catch (err: any) {
        lastLoadedIndexRef.current = null;
        lastLoadedBaseUrlRef.current = null;
        if (isMounted) safeSwitchServer();
      } finally {
        isCurrentlyLoadingRef.current = false;
      }
    };

    setTimeout(loadStreamSource, 50);
    return () => { isMounted = false; if (stallIntervalRef.current) clearInterval(stallIntervalRef.current); };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, isEngineReady, streams, safeSwitchServer, getMimeType, setIsBuffering]);
  }
