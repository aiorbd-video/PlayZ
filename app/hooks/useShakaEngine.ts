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

const parseClearKeys = (drmData: string | object | undefined): Record<string, string> => {
  if (!drmData) return {};
  try {
    let data = typeof drmData === 'string' ? drmData.trim() : drmData;
    if (typeof data === 'string' && data.startsWith('{')) { data = JSON.parse(data); }
    if (typeof data === 'object' && data !== null) {
      return Object.fromEntries(
        Object.entries(data).map(([kid, key]) => [
          kid.replace(/['"\s{}:]/g, ''), String(key).replace(/['"\s{}:]/g, '')
        ]).filter(([kid, key]) => kid && key)
      );
    }
    if (typeof data === 'string' && data.includes(':')) {
      const parts = data.replace(/['"\s{}]/g, '').split(':');
      if (parts.length === 2) return { [parts[0]]: parts[1] };
    }
    return {};
  } catch { return {}; }
};

export function useShakaEngine({
  currentStreamUrl, activeStreamIndex, streams, allServersDown,
  videoRef, videoContainerRef, loggerRef, setIsBuffering, safeSwitchServer, getMimeType,
}: UseShakaEngineProps) {
  const playerRef = useRef<any>(null);
  const uiRef = useRef<any>(null);
  const p2pEngineRef = useRef<any>(null); // 🎯 P2P ইঞ্জিন রেফারেন্স
  const playerInitRef = useRef<boolean>(false);
  const stallIntervalRef = useRef<any>(null);

  // ১. প্লেয়ার, ইউআই এবং P2P ইঞ্জিন ইনিশিয়ালাইজেশন
  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || playerInitRef.current) return;
    playerInitRef.current = true;

    let shaka: any;
    const initInstance = async () => {
      try {
        loggerRef.current?.addLog('Core: Creating pristine Shaka Instance...', 'info');
        
        // ডাইনামিক ইম্পোর্ট (SSR সেফ রাখার জন্য)
        shaka = await import('shaka-player/dist/shaka-player.ui');
        const { Engine: P2PEngine } = await import('p2p-media-loader-shaka');

        shaka.polyfill.installAll();

        // 🎯 কাস্টম Stretch বাটন
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

        // 🎯 P2P নেটওয়ার্ক লেয়ার সেটআপ
        if (P2PEngine.isSupported()) {
          p2pEngineRef.current = new P2PEngine({
            segments: {
              swarmId: currentStreamUrl || 'playz-live-swarm', // এই আইডি দিয়ে একই লিংকের ইউজাররা কানেক্ট হবে
            },
            loader: {
              cachedSegmentExpiration: 86400000,
              cachedSegmentsCount: 50,
            }
          });
          
          p2pEngineRef.current.initShakaPlayer(player);
          loggerRef.current?.addLog('🚀 P2P WebRTC Network Layer Injected!', 'success');

          // P2P ইভেন্ট লগিং (অপশনাল, শুধু আপনার দেখার জন্য)
          p2pEngineRef.current.on('peer_connect', () => loggerRef.current?.addLog('P2P: New Peer Connected!', 'info'));
          p2pEngineRef.current.on('piece_bytes_downloaded', (method: string, bytes: number) => {
            if (method === 'p2p') loggerRef.current?.addLog(`P2P: Downloaded ${(bytes / 1024).toFixed(1)} KB from peers!`, 'success');
          });
        }

        const ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        uiRef.current = ui;
        
        ui.configure({
          controlPanelElements: ['play_pause', 'time_and_duration', 'spacer', 'mute', 'volume', 'custom_stretch', 'fullscreen'],
          addSeekBar: true,
        });

        player.configure({
          streaming: {
            bufferingGoal: 12, rebufferingGoal: 2, bufferBehind: 20, stallEnabled: false, 
            retryParameters: { maxAttempts: 5, baseDelay: 1000, backoffFactor: 2 }
          },
          abr: { enabled: true, switchInterval: 8 },
          manifest: { dash: { autoCorrectDrift: true }, hls: { ignoreManifestProgramDateTime: true } }
        });

        const onBuffering = (e: any) => setIsBuffering(e.buffering);
        const onError = async (event: any) => {
          const error = event.detail;
          if (error.code === 1001) {
            loggerRef.current?.addLog(`Network Error 1001. Waiting 3s grace period...`, 'warn');
            setTimeout(() => { if (playerRef.current) safeSwitchServer(); }, 3000);
          } else if ([1002, 6007, 3016].includes(error.code)) {
            loggerRef.current?.addLog(`Fatal Error ${error.code}. Switching immediately...`, 'error');
            safeSwitchServer();
          } else {
            loggerRef.current?.addLog(`Recoverable Error ${error.code} (Ignored)`, 'warn');
          }
        };

        player.addEventListener('buffering', onBuffering);
        player.addEventListener('error', onError);

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
      if (playerRef.current && playerRef.current.__cleanupListeners) playerRef.current.__cleanupListeners();
      if (p2pEngineRef.current) { p2pEngineRef.current.destroy(); p2pEngineRef.current = null; }
      if (uiRef.current) { uiRef.current.destroy(); uiRef.current = null; }
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [safeSwitchServer, currentStreamUrl]);

  // ২. স্ট্রিম লোড রানার
  useEffect(() => {
    if (!playerRef.current || allServersDown || !currentStreamUrl || !streams?.length) return;

    let isMounted = true;

    const loadStreamSource = async () => {
      if (stallIntervalRef.current) { clearInterval(stallIntervalRef.current); stallIntervalRef.current = null; }

      setIsBuffering(true);
      loggerRef.current?.addLog(`Loading Source: Server [${activeStreamIndex + 1}]`, 'info');

      try {
        // P2P ইঞ্জিনকে নতুন স্ট্রিমের আইডি বোঝানো
        if (p2pEngineRef.current) {
          p2pEngineRef.current.setStreamId(currentStreamUrl);
        }

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
        
        const loadPromise = playerRef.current.load(currentStreamUrl, null, mimeType);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('20s Load Timeout Limit Reached')), 20000));

        await Promise.race([loadPromise, timeoutPromise]);

        if (videoRef.current && isMounted) {
          videoRef.current.play()
            .then(() => loggerRef.current?.addLog('Playback live on-screen!', 'success'))
            .catch(() => loggerRef.current?.addLog('Autoplay deferred. Waiting for interaction.', 'warn'));
        }

        if (isMounted) setIsBuffering(false);

        let lastTime = 0;
        let stallCount = 0;
        
        stallIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          if (!video) return;

          const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
          const bufferAhead = buffered - video.currentTime;
          const diff = video.currentTime - lastTime;
          
          if (video.readyState >= 3 && !video.paused && !video.seeking && diff < 0.01 && bufferAhead < 10) {
            stallCount++;
            loggerRef.current?.addLog(`Stall warning ${stallCount}/3 (Buffer: ${bufferAhead.toFixed(1)}s)...`, 'warn');
          } else {
            stallCount = 0;
          }

          if (stallCount >= 3) {
            loggerRef.current?.addLog('Playback stall confirmed. Switching...', 'error');
            safeSwitchServer();
          }
          lastTime = video.currentTime;
        }, 5000);

      } catch (err: any) {
        if (err.code === 7000 || err.code === 7002) {
          loggerRef.current?.addLog(`Load Interrupted (${err.code}). Ignored.`, 'info');
          return;
        }
        loggerRef.current?.addLog(`Loading Failed: ${err.message || err.code}`, 'error');
        if (isMounted) safeSwitchServer();
      }
    };

    const delayTimer = setTimeout(() => { loadStreamSource(); }, 50);

    return () => {
      isMounted = false;
      clearTimeout(delayTimer);
      if (stallIntervalRef.current) { clearInterval(stallIntervalRef.current); stallIntervalRef.current = null; }
    };
  }, [currentStreamUrl, activeStreamIndex, allServersDown, streams]);
}
