'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string) => {
  if (!url || url === "null") return "";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

// 🟢 লাইভ, আপকামিং নাকি শেষ—সেটা বের করার লজিক
const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return 'upcoming';

  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));

  if (currentTime > endTime) return 'recent';
  if (currentTime >= startTime && currentTime <= endTime) return 'live';
  return 'upcoming';
};

// 🚀 ম্যাজিক টাইমার: আপনার শর্ত অনুযায়ী সময় দেখানোর ডাইনামিক ফাংশন
const renderUpcomingTime = (startStr: string, currentTime: Date) => {
  if (!startStr) return <span className="text-[#3498db] font-bold text-xs">TBA</span>;
  
  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const diffMs = startTime.getTime() - currentTime.getTime();

  if (diffMs <= 0) return <span className="text-[#3498db] font-bold text-xs">Starting...</span>;

  const diffHours = diffMs / (1000 * 60 * 60);

  // শর্ত ১: ৬ ঘণ্টার বেশি হলে (ডেট এবং টাইম)
  if (diffHours > 6) {
    const dateStr = startTime.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{dateStr}</span>
        <span className="text-xs font-bold text-[#3498db] mt-0.5">{timeStr}</span>
      </div>
    );
  } 
  // শর্ত ২: ১ ঘণ্টা থেকে ৬ ঘণ্টার মধ্যে (ঘণ্টা এবং মিনিট)
  else if (diffHours > 1) {
    const h = Math.floor(diffHours);
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return (
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Starts In</span>
        <span className="text-xs font-bold text-orange-400">{h}h {m}m</span>
      </div>
    );
  } 
  // শর্ত ৩: ১ ঘণ্টার কম (মিনিট এবং সেকেন্ডের কাউন্টডাউন)
  else {
    const m = Math.floor(diffMs / (1000 * 60));
    const s = Math.floor((diffMs % (1000 * 60)) / 1000);
    return (
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5 animate-pulse">Starts In</span>
        <span className="text-sm font-black text-orange-500 font-mono tracking-wider">{m}m {s}s</span>
      </div>
    );
  }
};

const getCategoryIcon = (cat: string) => {
  if (cat === 'All') return <span className="text-xl font-bold text-[#3498db]">All</span>;
  const lowerCat = cat.toLowerCase();
  if (lowerCat.includes('cricket')) return <span className="text-2xl">🏏</span>;
  if (lowerCat.includes('football')) return <span className="text-2xl">⚽</span>;
  if (lowerCat.includes('wwe') || lowerCat.includes('wrestling')) return <span className="text-2xl">🤼‍♂️</span>;
  if (lowerCat.includes('tennis')) return <span className="text-2xl">🎾</span>;
  if (lowerCat.includes('basketball')) return <span className="text-2xl">🏀</span>;
  return <span className="text-2xl">🏆</span>;
};

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  // 🛡️ সিকিউরিটি ভেরিফিকেশন স্টেটসমূহ
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [captchaError, setCaptchaError] = useState<boolean>(false);

  // ⏱️ আপডেট: প্রতি ১ সেকেন্ড পর পর টাইম রিফ্রেশ হবে (কাউন্টডাউনের জন্য)
  useEffect(() => {
    setMounted(true);

    // সেশন চেক করা হচ্ছে যে আগে ভেরিফাই করা হয়েছে কি না
    const sessionAuth = sessionStorage.getItem('site_verified');
    if (sessionAuth === 'true') {
      setIsVerified(true);
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 🟢 ক্যাপচা টোকেন যাচাই করার এপিআই কল লজিক
  const handleGlobalVerify = async (token: string) => {
    setVerifying(true);
    setCaptchaError(false);
    try {
      const res = await fetch('/api/verify-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      if (res.ok) {
        sessionStorage.setItem('site_verified', 'true');
        setIsVerified(true);
      } else {
        setCaptchaError(true);
      }
    } catch {
      setCaptchaError(true);
    } finally {
      setVerifying(false);
    }
  };

  // 🟢 ১০০% সাকসেসফুল রেন্ডারিং লুপ (উইন্ডো লিসেনার মুক্ত পদ্ধতি)
  useEffect(() => {
    if (isVerified || !mounted) return;

    let widgetId: any = null;

    const tryExplicitRender = () => {
      const turnstile = (window as any).turnstile;
      const container = document.getElementById('global-captcha-box');

      // যদি ক্লাউডফ্লেয়ারের গ্লোবাল অবজেক্ট রেডি থাকে এবং কন্টেইনারটি খালি থাকে
      if (turnstile && container && container.innerHTML === '') {
        try {
          widgetId = turnstile.render('#global-captcha-box', {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAABgwttpTXHLnnVvake",
            callback: function(token: string) {
              if (token) {
                handleGlobalVerify(token);
              }
            },
          });
          // সফলভাবে রেন্ডার হয়ে গেলে লুপ বন্ধ করে দাও
          clearInterval(renderInterval);
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }
    };

    // প্রতি ৩০০ মিলিসেকেন্ড পর পর চেক করে জোর করে রেন্ডার করবেই করবে
    const renderInterval = setInterval(tryExplicitRender, 300);

    return () => {
      clearInterval(renderInterval);
      // মেমোরি ক্লিনআপ
      const turnstile = (window as any).turnstile;
      if (turnstile && widgetId !== null) {
        try { turnstile.remove(widgetId); } catch(e){}
      }
    };
  }, [isVerified, mounted]);

  // ইউজার ভেরিফাইড হলে এপিআই থেকে ডাটা আসবে, নয়তো আসবে না (ডাটা প্রোটেকশন)
  const { data: matches } = useSWR(isVerified ? MATCH_API : null, fetcher, { refreshInterval: 60000 });

  const dynamicCategories = ['All'];
  if (matches && Array.isArray(matches)) {
    const uniqueCats = new Set(matches.map((m: any) => m.eventInfo?.eventCat).filter(Boolean));
    uniqueCats.forEach(cat => dynamicCategories.push(cat as string));
  }

  const filters = ['All', 'Live', 'Recent', 'Upcoming'];

  const processedMatches = matches?.filter((match: any) => {
    if (activeCategory !== 'All' && match.eventInfo?.eventCat !== activeCategory) return false;
    
    const status = getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, currentTime);
    if (activeFilter === 'Live' && status !== 'live') return false;
    if (activeFilter === 'Recent' && status !== 'recent') return false;
    if (activeFilter === 'Upcoming' && status !== 'upcoming') return false;
    
    return true;
  }).sort((a: any, b: any) => {
    const aStart = new Date(a.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
    const bStart = new Date(b.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
    const aEnd = new Date(a.eventInfo?.endTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
    const bEnd = new Date(b.eventInfo?.endTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();

    const aStatus = getMatchStatus(a.eventInfo?.startTime, a.eventInfo?.endTime, currentTime);
    const bStatus = getMatchStatus(b.eventInfo?.startTime, b.eventInfo?.endTime, currentTime);

    if (activeFilter === 'All') {
      const priority: any = { live: 1, upcoming: 2, recent: 3 };
      if (priority[aStatus] !== priority[bStatus]) {
        return priority[aStatus] - priority[bStatus];
      }
      if (aStatus === 'upcoming') return aStart - bStart; 
      if (aStatus === 'recent') return bEnd - aEnd;       
      return 0;
    }

    if (activeFilter === 'Upcoming') return aStart - bStart;
    if (activeFilter === 'Recent') return bEnd - aEnd;

    return 0;
  });

  if (!mounted) return null;

  // 🛡️ গেটওয়ে স্ক্রিন: ইউজার ক্যাপচা ভেরিফাই না করা পর্যন্ত ফুল পেজ লক থাকবে
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-[#0f111a] flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="max-w-md w-full bg-[#161925] p-8 rounded-2xl border border-gray-800 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-[#3498db]/10 rounded-full flex items-center justify-center mb-4 text-[#3498db]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m3.432-3.432a8 8 0 11-6.864 0M12 9V7m0 2a3 3 0 110 6 3 3 0 010-6z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 tracking-wide uppercase">All In One Sports</h1>
          <p className="text-gray-400 text-sm mb-6 max-w-xs">Please complete the security check to safely access live dashboard.</p>
          
          <div className="flex justify-center min-h-[75px] w-full">
            {/* 🟢 ক্লাউডফ্লেয়ার উইজেট রেন্ডারিং টার্গেট বক্স */}
            <div id="global-captcha-box"></div>
          </div>

          {verifying && (
            <div className="flex items-center gap-2 text-blue-400 text-xs mt-4 animate-pulse">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              Securing connection gateway...
            </div>
          )}

          {captchaError && (
            <p className="text-red-500 text-xs mt-4 font-bold bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
              Verification Failed! Please reload page and try again.
            </p>
          )}
        </div>
      </div>
    );
  }

  // 🎉 আসল মেইন ড্যাশবোর্ড স্ক্রিন (ভেরিফিকেশন সফল হলে এটি আনলক হবে)
  return (
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-20">
      
      {/* 🔴 Top Header */}
      <nav className="p-4 bg-[#12141c] sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="text-gray-300 hover:text-white outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-[#3498db] tracking-wide">All in one sports web</h1>
        </div>
        <div className="flex items-center gap-4 text-gray-300">
          <button className="outline-none hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
          <button className="outline-none hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 mt-2">
        
        {/* ⚾ Dynamic Category Circles */}
        <div className="flex items-center justify-around md:justify-start md:gap-10 py-4 mb-2 overflow-x-auto scrollbar-hide">
          {dynamicCategories.map((cat) => (
            <div key={cat} onClick={() => setActiveCategory(cat)} className="flex flex-col items-center gap-2 cursor-pointer outline-none group min-w-[70px]">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                activeCategory === cat ? 'bg-[#1e2738] border-2 border-[#3498db] shadow-lg shadow-[#3498db]/20' : 'bg-[#1a1e29] border border-gray-800 group-hover:bg-[#202533]'
              }`}>
                {getCategoryIcon(cat)}
              </div>
              <span className={`text-xs font-semibold ${activeCategory === cat ? 'text-[#3498db]' : 'text-gray-400'} truncate max-w-[70px]`}>{cat}</span>
            </div>
          ))}
        </div>

        {/* 🎛️ Filter Pills */}
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide mb-6 py-1">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border outline-none flex items-center gap-2 ${
                activeFilter === filter
                  ? "bg-[#1e2738] border-[#3498db] text-white shadow-md shadow-[#3498db]/10"
                  : "bg-[#1a1e29] border-transparent text-gray-400 hover:text-white hover:bg-[#202533]"
              }`}
            >
              {activeFilter === filter && <span className="w-1.5 h-1.5 bg-[#3498db] rounded-full"></span>}
              {filter}
            </button>
          ))}
        </div>

        {/* 🏟️ Matches List */}
        {!matches && <div className="text-center py-10 text-gray-400 animate-pulse font-medium">Loading premium matches...</div>}
        {matches && processedMatches?.length === 0 && (
          <div className="text-center py-10 text-gray-500 font-medium bg-[#1a1e29] rounded-xl border border-gray-800">
            No {activeFilter !== 'All' ? activeFilter : ''} matches found in {activeCategory}.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {processedMatches?.map((match: any) => {
            const eventInfo = match.eventInfo || {};
            const status = getMatchStatus(eventInfo.startTime, eventInfo.endTime, currentTime);

            return (
              <Link href={`/watch/${match.id}`} key={match.id} className="outline-none" prefetch={false}>
                <div className="bg-[#1a1e29] border border-[#2d6a85]/20 rounded-2xl p-5 transition-all hover:bg-[#1e2433] hover:border-[#3498db]/40 shadow-sm relative overflow-hidden group">
                  
                  {/* Top: Category & Event Name */}
                  {(eventInfo.eventCat || eventInfo.eventName) && (
                    <div className="text-sm text-gray-300 font-medium mb-5 flex items-center justify-center gap-2">
                      {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
                        <img src={getImg(eventInfo.eventLogo)} className="w-4 h-4 object-contain rounded-full" alt="" loading="lazy" />
                      )}
                      <span className="truncate">
                        {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' | ')}
                      </span>
                    </div>
                  )}

                  {/* Bottom: Team VS Team Layout */}
                  <div className="flex justify-between items-center px-2 md:px-8">
                    
                    {/* Team A */}
                    {eventInfo.teamA && (
                      <div className="flex flex-col items-center gap-3 w-1/3">
                        {eventInfo.teamAFlag && eventInfo.teamAFlag !== "null" ? (
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full p-0.5 bg-gray-800/50 shadow-inner group-hover:scale-105 transition-transform">
                            <img src={getImg(eventInfo.teamAFlag)} className="w-full h-full object-cover rounded-full" loading="lazy" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gray-800 flex items-center justify-center text-xl">🛡️</div>
                        )}
                        <span className="font-bold text-sm md:text-base text-gray-100 truncate w-full text-center">{eventInfo.teamA}</span>
                      </div>
                    )}

                    {/* Center: Dynamic Status Badge */}
                    <div className="w-1/3 flex justify-center mt-[-20px]">
                      {status === 'live' && (
                        <span className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg font-black text-xs tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute opacity-75"></span>
                          <span className="w-2 h-2 bg-red-500 rounded-full relative"></span> LIVE
                        </span>
                      )}
                      
                      {status === 'upcoming' && (
                        <div className="bg-[#1e2738] border border-[#2d6a85]/50 px-3 py-1.5 rounded-lg flex items-center justify-center min-w-[80px] shadow-inner">
                          {renderUpcomingTime(eventInfo.startTime, currentTime)}
                        </div>
                      )}

                      {status === 'recent' && (
                        <span className="bg-[#252a38] text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg font-bold text-xs tracking-wider uppercase">
                          Ended
                        </span>
                      )}
                    </div>

                    {/* Team B */}
                    {eventInfo.teamB && (
                      <div className="flex flex-col items-center gap-3 w-1/3">
                        {eventInfo.teamBFlag && eventInfo.teamBFlag !== "null" ? (
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full p-0.5 bg-gray-800/50 shadow-inner group-hover:scale-105 transition-transform">
                            <img src={getImg(eventInfo.teamBFlag)} className="w-full h-full object-cover rounded-full" loading="lazy" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gray-800 flex items-center justify-center text-xl">🛡️</div>
                        )}
                        <span className="font-bold text-sm md:text-base text-gray-100 truncate w-full text-center">{eventInfo.teamB}</span>
                      </div>
                    )}

                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </main>
  );
}
