'use client';

import { useEffect, useRef, useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import 'shaka-player/dist/controls.css';

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string) => {
  if (!url || url === "null") return "";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return { type: "upcoming", label: "TBA" };
  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  if (currentTime > endTime) return { type: "ended", label: "Ended" };
  else if (currentTime >= startTime && currentTime <= endTime) return { type: "live", label: "LIVE" };
  else return { type: "upcoming", label: startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) };
};

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const [activeStreamIndex, setActiveStreamIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [streams, setStreams] = useState<any[] | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveStreamIndex(0);
    setStreams(null);
    setCaptchaToken(null);
    setCaptchaError(false);
    setVerifying(false);
  }, [id]);

  const { data: matches } = useSWR(MATCH_API, fetcher);
  const currentMatch = matches?.find((m: any) => m.id.toString() === id);

  const handleCaptchaVerify = async (token: string) => {
    setCaptchaToken(token);
    setVerifying(true);
    try {
      const res = await fetch(`/api/streams/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (res.ok) {
        setStreams(await res.json());
      } else {
        setCaptchaError(true);
      }
    } catch {
      setCaptchaError(true);
    } finally {
      setVerifying(false);
    }
  };

  // 🟢 গ্লোবাল ক্যাপচা রেন্ডার লজিক
  useEffect(() => {
    (window as any).javascript_captcha_callback = (token: string) => handleCaptchaVerify(token);
    
    const checkAndRender = setInterval(() => {
      const turnstile = (window as any).turnstile;
      const container = document.getElementById('cf-turnstile-container');
      if (turnstile && container && container.innerHTML === '') {
        turnstile.render('#cf-turnstile-container', {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAABgwttpTXHLnnVvake",
          callback: 'javascript_captcha_callback',
        });
        clearInterval(checkAndRender);
      }
    }, 500);
    return () => clearInterval(checkAndRender);
  }, [id, streams]);

  useEffect(() => {
    if (!videoRef.current || !videoContainerRef.current || !streams) return;
    let player: any, ui: any;
    import('shaka-player/dist/shaka-player.ui.js').then((module) => {
      const shaka = module as any;
      if (shaka.Player.isBrowserSupported()) {
        player = new shaka.Player(videoRef.current);
        ui = new shaka.ui.Overlay(player, videoContainerRef.current, videoRef.current);
        player.load(streams[activeStreamIndex]?.link);
        setPlayerInstance(player);
      }
    });
    return () => { if (player) player.destroy(); };
  }, [streams, activeStreamIndex]);

  return (
    <main className="min-h-screen bg-[#12141c] text-white">
      <nav className="p-3 bg-[#181a20] border-b border-gray-800">
        <Link href="/">Back</Link>
      </nav>
      <div className="max-w-7xl mx-auto p-4">
        <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
          {!streams ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
              <div id="cf-turnstile-container" className="mb-4"></div>
              {verifying && <p>Verifying Security...</p>}
              {captchaError && <p className="text-red-500">Failed, Reload!</p>}
            </div>
          ) : (
            <div ref={videoContainerRef} className="w-full h-full">
              <video ref={videoRef} className="w-full h-full" autoPlay playsInline />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
