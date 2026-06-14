'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string) => {
  if (!url || url === "null") return "/fallback-logo.png";
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

// 🟢 ফিক্সড কাউন্টডাউন (মিনিট-সেকেন্ড কাউন্ট ও এন্ডেড স্ট্যাটাস সহ)
const MatchCountdown = memo(({ startTimeStr, endTimeStr, status }: { startTimeStr: string, endTimeStr: string, status: string }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startTime = startTimeStr ? new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')) : null;
  const endTime = endTimeStr ? new Date(endTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')) : null;

  if (status === 'recent' || (endTime && time > endTime)) {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className="text-gray-500 text-xs font-bold tracking-wide uppercase px-2 py-0.5 bg-gray-800 rounded-md">Ended</span>
      </div>
    );
  }

  if (status === 'live') {
    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg animate-pulse">((•))</span>
        <span className="text-red-500 text-xs font-bold tracking-wide uppercase">Live</span>
      </div>
    );
  }

  if (!startTime) return <span className="text-gray-400 font-bold text-xs">TBA</span>;
  
  const diffMs = startTime.getTime() - time.getTime();

  if (diffMs <= 0) return <span className="text-green-500 font-bold text-xs animate-pulse">Starting...</span>;
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

  const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="text-gray-300 text-[13px] font-semibold">{timeStr}</div>
      <div className="text-[#00E5FF] text-[11px] font-semibold mt-0.5">{dateStr}</div>
      
      {diffHours > 0 ? (
        <div className="text-gray-400 text-[10px] mt-2 font-medium whitespace-nowrap">
          Starting in {diffHours}h {diffMins}m
        </div>
      ) : (
        <div className="text-amber-400 text-[11px] mt-2 font-bold whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
          Starting in {diffMins}m {diffSecs}s
        </div>
      )}
    </div>
  );
});
MatchCountdown.displayName = 'MatchCountdown';

const getCategoryIcon = (cat: string) => {
  if (cat === 'All') return <span className="text-xl">🔄</span>;
  const lowerCat = cat.toLowerCase();
  if (lowerCat.includes('cricket')) return <span className="text-2xl">🏏</span>;
  if (lowerCat.includes('football')) return <span className="text-2xl">⚽</span>;
  if (lowerCat.includes('wwe') || lowerCat.includes('wrestling')) return <span className="text-2xl">🤼</span>;
  if (lowerCat.includes('racing') || lowerCat.includes('formula')) return <span className="text-2xl">🏎️</span>;
  if (lowerCat.includes('hockey')) return <span className="text-2xl">🏑</span>;
  if (lowerCat.includes('basketball')) return <span className="text-2xl">🏀</span>;
  return <span className="text-2xl">🏆</span>;
};

const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || {};

  return (
    // 🟢 ফিক্সড ক্লিক অ্যানিমেশন: পিসির জন্য সলিড প্রেস ইফেক্ট
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.5 }}
      whileTap={{ scale: 0.97 }}
    >
    <Link 
      href={`/watch/${match.id}`} 
      className="outline-none rounded-2xl focus:outline-none group block content-visibility-auto contain-intrinsic-size-[180px]"
      prefetch={false}
    >
      <div className="bg-[#1C1E2B] border border-[#00E5FF]/40 rounded-[20px] p-5 transition-all duration-150 transform group-hover:border-[#00E5FF] group-focus:scale-[1.03] group-focus:border-[#00E5FF] active:scale-[0.97] active:border-[#00E5FF] active:ring-2 active:ring-[#00E5FF]/30 shadow-lg flex flex-col justify-between h-full min-h-[160px]">
        
        {(eventInfo.eventCat || eventInfo.eventName) && (
          <div className="text-[13px] md:text-sm text-gray-200 font-semibold mb-5 flex items-center justify-center gap-2">
            {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
              <div className="relative w-4 h-4">
                <Image 
                  src={getImg(eventInfo.eventLogo)} 
                  alt="" 
                  fill
                  sizes="16px"
                  className="object-contain rounded-full"
                  unoptimized
                />
              </div>
            )}
            <span className="truncate max-w-[250px]">
              {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' | ')}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center mt-auto">
          <div className="flex flex-col items-center gap-2.5 w-[30%]">
            <div className="relative w-12 h-12 md:w-14 md:h-14 bg-black/40 border border-gray-700/50 rounded-full flex items-center justify-center overflow-hidden p-0.5">
              <Image src={getImg(eventInfo.teamAFlag)} alt="" fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized />
            </div>
            <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center">{eventInfo.teamA || 'Team A'}</span>
          </div>

          <div className="w-[40%] flex justify-center items-center">
            <MatchCountdown startTimeStr={eventInfo.startTime} endTimeStr={eventInfo.endTime} status={status} />
          </div>

          <div className="flex flex-col items-center gap-2.5 w-[30%]">
            <div className="relative w-12 h-12 md:w-14 md:h-14 bg-black/40 border border-gray-700/50 rounded-full flex items-center justify-center overflow-hidden p-0.5">
              <Image src={getImg(eventInfo.teamBFlag)} alt="" fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized />
            </div>
            <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center">{eventInfo.teamB || 'Team B'}</span>
          </div>
        </div>

      </div>
    </Link>
    </motion.div>
  );
});
MatchCard.displayName = 'MatchCard';

function MatchSkeleton() {
  return (
    <div className="bg-[#1C1E2B] border border-gray-800/60 rounded-[20px] p-5 animate-pulse flex flex-col gap-5 h-[160px]">
      <div className="h-4 bg-gray-800 rounded w-2/3 mx-auto"></div>
      <div className="flex justify-between items-center px-2">
        <div className="w-12 h-12 rounded-full bg-gray-800"></div>
        <div className="w-16 h-8 bg-gray-800 rounded"></div>
        <div className="w-12 h-12 rounded-full bg-gray-800"></div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchInp, setSearchInp] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    // 🟢 গ্লোবাল টাইম রিফ্রেশ ৫ সেকেন্ড করা হয়েছে
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInp);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInp]);

  const { data: matches, error } = useSWR(MATCH_API, fetcher, { refreshInterval: 30000 });

  const dynamicCategories = useMemo(() => {
    const list = ['All'];
    if (matches && Array.isArray(matches)) {
      const uniqueCats = new Set(matches.map((m: any) => m.eventInfo?.eventCat).filter(Boolean));
      uniqueCats.forEach(cat => list.push(cat as string));
    }
    return list;
  }, [matches]);

  const stats = useMemo(() => {
    if (!matches) return { all: 0, live: 0, recent: 0, upcoming: 0 };
    let live = 0, recent = 0, upcoming = 0;
    matches.forEach((m: any) => {
      const status = getMatchStatus(m.eventInfo?.startTime, m.eventInfo?.endTime, currentTime);
      if (status === 'live') live++;
      if (status === 'recent') recent++;
      if (status === 'upcoming') upcoming++;
    });
    return { all: matches.length, live, recent, upcoming };
  }, [matches, currentTime]);

  const filters = [
    { id: 'All', label: `All (${stats.all})`, icon: '✔️' },
    { id: 'Live', label: `Live (${stats.live})`, icon: '' },
    { id: 'Recent', label: `Recent (${stats.recent})`, icon: '' },
    { id: 'Upcoming', label: `Upcoming (${stats.upcoming})`, icon: '' }
  ];

  const processedMatches = useMemo(() => {
    if (!matches) return [];

    return [...matches].filter((match: any) => {
      const eventInfo = match.eventInfo || {};
      if (activeCategory !== 'All' && eventInfo.eventCat !== activeCategory) return false;
      
      const status = getMatchStatus(eventInfo.startTime, eventInfo.endTime, currentTime);
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
      const aStart = new Date(a.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
      const bStart = new Date(b.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
      const aStatus = getMatchStatus(a.eventInfo?.startTime, a.eventInfo?.endTime, currentTime);
      const bStatus = getMatchStatus(b.eventInfo?.startTime, b.eventInfo?.endTime, currentTime);

      if (activeFilter === 'All') {
        const priority: any = { live: 1, upcoming: 2, recent: 3 };
        if (priority[aStatus] !== priority[bStatus]) return priority[aStatus] - priority[bStatus];
        if (aStatus === 'upcoming') return aStart - bStart; 
        return 0;
      }
      if (activeFilter === 'Upcoming') return aStart - bStart;
      return 0;
    });
  }, [matches, activeCategory, activeFilter, debouncedSearch, currentTime]);

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20 tv:p-8 animate-fade-in">
      
      <motion.nav 
        initial={{ y: -100, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.5 }}
        className="p-4 bg-[#11131A]/90 sticky top-0 z-50 flex items-center justify-between border-b border-gray-800/60 backdrop-blur-md max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-black text-[#00E5FF] tracking-wide uppercase tv:text-3xl">All in one sports</h1>
        </div>

        <div className="flex items-center gap-3 w-full max-w-xs justify-end">
          {showSearch && (
            <motion.input 
              initial={{ width: 0, opacity: 0 }} 
              animate={{ width: '100%', opacity: 1 }} 
              transition={{ duration: 0.3 }}
              type="text" 
              placeholder="Search team or event..." 
              value={searchInp}
              onChange={(e) => setSearchInp(e.target.value)}
              className="bg-[#1C1E2B] border border-gray-700 text-sm rounded-xl px-4 py-2 w-full focus:outline-none focus:border-[#00E5FF] transition-all text-white"
              autoFocus
            />
          )}
          <button onClick={() => { setShowSearch(!showSearch); setSearchInp(''); setDebouncedSearch(''); }} className="outline-none text-gray-300 hover:text-[#00E5FF] focus:text-[#00E5FF]">
            {showSearch ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
          </button>
        </div>
      </motion.nav>

      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        transition={{ duration: 0.5, delay: 0.2 }}
        className="max-w-7xl mx-auto px-4 mt-2"
      >
        
        <div className="flex items-center justify-start gap-5 md:gap-8 py-6 mb-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x">
          {dynamicCategories.map((cat, i) => (
            <motion.button 
              key={cat} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => setActiveCategory(cat)} 
              className="flex flex-col items-center gap-2 cursor-pointer outline-none group min-w-[65px] snap-center focus:outline-none"
            >
              <div className={`w-[60px] h-[60px] md:w-[70px] md:h-[70px] rounded-full flex items-center justify-center transition-all duration-300 transform group-focus:scale-110 group-focus:ring-4 group-focus:ring-[#00E5FF]/50 ${
                activeCategory === cat ? 'bg-[#1C1E2B] border-2 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3)]' : 'bg-[#1C1E2B] border border-gray-700/50 text-gray-400 group-hover:border-gray-500'
              }`}>
                {getCategoryIcon(cat)}
              </div>
              <span className={`text-[12px] font-semibold transition-colors ${activeCategory === cat ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'} truncate max-w-[75px]`}>{cat}</span>
            </motion.button>
          ))}
        </div>

        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide mb-8 py-1 snap-x">
          {filters.map((filter, i) => (
            <motion.button
              key={filter.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 + 0.2 }}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border snap-center focus:outline-none flex items-center gap-2 ${
                activeFilter === filter.id
                  ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-md"
                  : "bg-[#1C1E2B] border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              {activeFilter === filter.id && filter.icon && <span>{filter.icon}</span>}
              {filter.label}
            </motion.button>
          ))}
        </div>

        {error && <div className="text-center py-10 text-red-400 font-medium">Failed to load data.</div>}
        
        {!matches && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
          </div>
        )}

        {matches && processedMatches.length === 0 && (
          <div className="text-center py-12 text-gray-500 font-semibold bg-[#1C1E2B] rounded-2xl border border-gray-800/40 animate-fade-in">
            No matches available matching your criteria.
          </div>
        )}

        <motion.div 
            layout 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {processedMatches.map((match: any) => {
            const status = getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, currentTime);
            return <MatchCard key={match.id} match={match} status={status} />;
          })}
        </motion.div>
      </motion.div>

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
