'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image'; // 🟢 Next/Image ইমপোর্ট করা হলো

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string) => {
  if (!url || url === "null") return "/fallback-logo.png"; // ডিফল্ট লোগো পাথ
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return 'upcoming';
  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  if (currentTime > endTime) return 'recent';
  if (currentTime >= startTime && currentTime <= endTime) return 'live';
  return 'upcoming';
};

// ⏱️ ৫. Timer Isolation: কাউন্টডাউন টাইম ট্র্যাকিংকে একদম আলাদা কম্পোনেন্টে লক করা হলো
// এর ফলে প্রতি সেকেন্ডের টিক-টিক কাউন্টে পুরো পেজ বা ম্যাচ কার্ড রি-রেন্ডার হবে না
const MatchCountdown = memo(({ startTimeStr }: { startTimeStr: string }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startTimeStr) return <span className="text-[#3498db] font-bold text-xs">TBA</span>;
  const startTime = new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const diffMs = startTime.getTime() - time.getTime();

  if (diffMs <= 0) return <span className="text-[#3498db] font-bold text-xs">Starting...</span>;
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours > 6) {
    const dateStr = startTime.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{dateStr}</span>
        <span className="text-xs font-bold text-[#3498db] mt-0.5">{timeStr}</span>
      </div>
    );
  } else if (diffHours > 1) {
    const h = Math.floor(diffHours);
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return (
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5">Starts In</span>
        <span className="text-xs font-bold text-orange-400">{h}h {m}m</span>
      </div>
    );
  } else {
    const m = Math.floor(diffMs / (1000 * 60));
    const s = Math.floor((diffMs % (1000 * 60)) / 1000);
    return (
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-gray-400 uppercase tracking-widest mb-0.5 animate-pulse">Starts In</span>
        <span className="text-sm font-black text-orange-500 font-mono tracking-wider">{m}m {s}s</span>
      </div>
    );
  }
});
MatchCountdown.displayName = 'MatchCountdown';

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

// 🏟️ ২. MatchCard Component: মেমোয়াইজড কাস্টম কম্পোনেন্ট যা শুধুমাত্র ডাটা চেঞ্জ হলে রেন্ডার হবে
const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || {};

  return (
    <Link 
      href={`/watch/${match.id}`} 
      className="outline-none rounded-2xl focus:outline-none group block content-visibility-auto contain-intrinsic-size-[180px]" // 🟢 ৬. Virtualization/Containment ইফেক্ট
      prefetch={false}
    >
      <div className="bg-[#141822] border border-gray-800/50 rounded-2xl p-5 transition-all duration-300 transform group-hover:bg-[#1a202e] group-hover:border-[#3498db]/40 group-focus:scale-[1.03] group-focus:bg-[#1a202e] group-focus:border-[#3498db] group-focus:ring-4 group-focus:ring-[#3498db]/20 shadow-md flex flex-col justify-between h-full min-h-[180px]">
        
        {/* Top: Category & Event Name */}
        {(eventInfo.eventCat || eventInfo.eventName) && (
          <div className="text-xs md:text-sm text-gray-400 font-semibold mb-4 flex items-center justify-center gap-2 border-b border-gray-800/30 pb-2">
            {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
              <div className="relative w-4 h-4">
                {/* 🟢 ৩. Next/Image অপ্টিমাইজেশন */}
                <Image 
                  src={getImg(eventInfo.eventLogo)} 
                  alt="" 
                  fill
                  sizes="16px"
                  className="object-contain rounded-full"
                  unoptimized // প্রক্সি ইমেজের জন্য আনঅপ্টিমাইজড ট্র্যাকিং রাখা ভালো
                />
              </div>
            )}
            <span className="truncate max-w-[200px]">
              {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' | ')}
            </span>
          </div>
        )}

        {/* Teams Layout */}
        <div className="flex justify-between items-center mt-auto">
          {/* Team A */}
          <div className="flex flex-col items-center gap-2.5 w-1/3">
            <div className="relative w-12 h-12 md:w-14 md:h-14 bg-gray-800/40 border border-gray-700/30 rounded-full p-0.5 overflow-hidden">
              <Image src={getImg(eventInfo.teamAFlag)} alt="" fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized />
            </div>
            <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center tracking-wide">{eventInfo.teamA || 'Team A'}</span>
          </div>

          {/* Center Badge */}
          <div className="w-1/3 flex justify-center items-center">
            {status === 'live' && (
              <span className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-xl font-black text-[10px] tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> LIVE
              </span>
            )}
            {status === 'upcoming' && (
              <div className="bg-[#1b2230] border border-gray-800/80 px-2.5 py-1.5 rounded-xl flex items-center justify-center min-w-[85px]">
                <MatchCountdown startTimeStr={eventInfo.startTime} />
              </div>
            )}
            {status === 'recent' && (
              <span className="bg-gray-800/40 text-gray-500 border border-gray-800 px-2.5 py-1.5 rounded-xl font-bold text-[10px] tracking-wider uppercase">
                Ended
              </span>
            )}
          </div>

          {/* Team B */}
          <div className="flex flex-col items-center gap-2.5 w-1/3">
            <div className="relative w-12 h-12 md:w-14 md:h-14 bg-gray-800/40 border border-gray-700/30 rounded-full p-0.5 overflow-hidden">
              <Image src={getImg(eventInfo.teamBFlag)} alt="" fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized />
            </div>
            <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center tracking-wide">{eventInfo.teamB || 'Team B'}</span>
          </div>
        </div>

      </div>
    </Link>
  );
});
MatchCard.displayName = 'MatchCard';

function MatchSkeleton() {
  return (
    <div className="bg-[#1a1e29] border border-gray-800/40 rounded-2xl p-5 animate-pulse flex flex-col gap-5 h-[180px]">
      <div className="h-4 bg-gray-800 rounded w-1/3 mx-auto"></div>
      <div className="flex justify-between items-center px-2">
        <div className="w-12 h-12 rounded-full bg-gray-800"></div>
        <div className="w-12 h-6 bg-gray-800 rounded"></div>
        <div className="w-12 h-12 rounded-full bg-gray-800"></div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchInp, setSearchInp] = useState(''); // রিয়েল-টাইম ইনপুট স্টেট
  const [debouncedSearch, setDebouncedSearch] = useState(''); // 🔍 ৪. Debounced Search স্টেট
  const [showSearch, setShowSearch] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔍 ৪. Debounce Logic Effect (৩০০ মিলিমেকেন্ড বাফার)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInp);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInp]);

  const { data: matches, error } = useSWR(MATCH_API, fetcher, { refreshInterval: 30000 });

  // 🟢 ১. useMemo: ডাইনামিক ক্যাটাগরি মেমোয়াইজেশন
  const dynamicCategories = useMemo(() => {
    const list = ['All'];
    if (matches && Array.isArray(matches)) {
      const uniqueCats = new Set(matches.map((m: any) => m.eventInfo?.eventCat).filter(Boolean));
      uniqueCats.forEach(cat => list.push(cat as string));
    }
    return list;
  }, [matches]);

  const filters = ['All', 'Live', 'Recent', 'Upcoming'];

  // 🟢 ১. useMemo: ফিল্টারিং এবং সর্টিং লজিক মেমোয়াইজেশন (সুপার অপ্টিমাইজড)
  const processedMatches = useMemo(() => {
    if (!matches) return [];
    const now = new Date();

    return matches.filter((match: any) => {
      const eventInfo = match.eventInfo || {};
      if (activeCategory !== 'All' && eventInfo.eventCat !== activeCategory) return false;
      
      const status = getMatchStatus(eventInfo.startTime, eventInfo.endTime, now);
      if (activeFilter === 'Live' && status !== 'live') return false;
      if (activeFilter === 'Recent' && status !== 'recent') return false;
      if (activeFilter === 'Upcoming' && status !== 'upcoming') return false;
      
      if (debouncedSearch.trim() !== '') {
        const query = debouncedSearch.toLowerCase();
        return (
          (eventInfo.teamA || '').toLowerCase().includes(query) ||
          (eventInfo.teamB || '').toLowerCase().includes(query) ||
          (eventInfo.eventName || '').toLowerCase().includes(query)
        );
      }
      return true;
    }).sort((a: any, b: any) => {
      const nowTime = new Date();
      const aStart = new Date(a.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
      const bStart = new Date(b.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
      const aStatus = getMatchStatus(a.eventInfo?.startTime, a.eventInfo?.endTime, nowTime);
      const bStatus = getMatchStatus(b.eventInfo?.startTime, b.eventInfo?.endTime, nowTime);

      if (activeFilter === 'All') {
        const priority: any = { live: 1, upcoming: 2, recent: 3 };
        if (priority[aStatus] !== priority[bStatus]) return priority[aStatus] - priority[bStatus];
        if (aStatus === 'upcoming') return aStart - bStart; 
        return 0;
      }
      if (activeFilter === 'Upcoming') return aStart - bStart;
      return 0;
    });
  }, [matches, activeCategory, activeFilter, debouncedSearch]);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#0d0f14] text-white font-sans pb-20 tv:p-8">
      
      {/* Header */}
      <nav className="p-4 bg-[#0d0f14]/90 sticky top-0 z-50 flex items-center justify-between border-b border-gray-900/60 backdrop-blur-md max-w-7xl mx-auto rounded-b-xl">
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-black text-[#3498db] tracking-wide uppercase tv:text-3xl">All in one sports</h1>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-3 w-full max-w-xs justify-end">
          {showSearch && (
            <input 
              type="text" 
              placeholder="Search team or event..." 
              value={searchInp}
              onChange={(e) => setSearchInp(e.target.value)} // ডেবোউন্সড ইনপুট ট্রিগার
              className="bg-[#161a24] border border-gray-800 text-sm rounded-xl px-4 py-2 w-full focus:outline-none focus:border-[#3498db] transition-all text-white"
              autoFocus
            />
          )}
          <button onClick={() => { setShowSearch(!showSearch); setSearchInp(''); setDebouncedSearch(''); }} className="outline-none text-gray-300 hover:text-[#3498db] focus:text-[#3498db]">
            {showSearch ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-4">
        
        {/* Categories Navbar */}
        <div className="flex items-center justify-start gap-4 md:gap-8 py-4 mb-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x">
          {dynamicCategories.map((cat) => (
            <button 
              key={cat} 
              onClick={() => setActiveCategory(cat)} 
              className="flex flex-col items-center gap-2 cursor-pointer outline-none group min-w-[75px] snap-center focus:outline-none"
            >
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center transition-all duration-200 transform group-focus:scale-110 group-focus:ring-4 group-focus:ring-[#3498db] ${
                activeCategory === cat ? 'bg-[#1e2738] border-2 border-[#3498db] shadow-lg shadow-[#3498db]/20' : 'bg-[#141822] border border-gray-800/60 group-hover:bg-[#1c2230]'
              }`}>
                {getCategoryIcon(cat)}
              </div>
              <span className={`text-xs font-bold transition-colors ${activeCategory === cat ? 'text-[#3498db]' : 'text-gray-400 group-hover:text-white'} truncate max-w-[75px]`}>{cat}</span>
            </button>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide mb-8 py-1 snap-x">
          {filters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border snap-center focus:outline-none focus:ring-2 focus:ring-[#3498db] flex items-center gap-2 ${
                activeFilter === filter
                  ? "bg-[#1e2738] border-[#3498db] text-white shadow-md shadow-[#3498db]/10"
                  : "bg-[#141822] border-transparent text-gray-400 hover:text-white hover:bg-[#1c2230]"
              }`}
            >
              {activeFilter === filter && <span className="w-1.5 h-1.5 bg-[#3498db] rounded-full animate-pulse"></span>}
              {filter}
            </button>
          ))}
        </div>

        {/* Matches Grid Layer */}
        {error && <div className="text-center py-10 text-red-400 font-medium">Failed to load data.</div>}
        
        {!matches && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
          </div>
        )}

        {matches && processedMatches.length === 0 && (
          <div className="text-center py-12 text-gray-500 font-semibold bg-[#141822] rounded-2xl border border-gray-800/40">
            No matches available matching your criteria.
          </div>
        )}

        {/* 🏟️ মেইন ম্যাচ লিস্ট গ্রিড */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {processedMatches.map((match: any) => {
            const now = new Date();
            const status = getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, now);
            return <MatchCard key={match.id} match={match} status={status} />;
          })}
        </div>
      </div>

      {/* CSS কন্টেইনমেন্ট লেয়ার */}
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .content-visibility-auto { content-visibility: auto; }
        @media (min-width: 1920px) {
          .tv\\:p-8 { padding: 2rem !important; }
          .tv\\:text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
        }
      `}} />
    </main>
  );
}
