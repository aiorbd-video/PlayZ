'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const MATCH_API = "/api/proxy-matches"; 

const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string | undefined | null) => {
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

const generateSlug = (teamA?: string, teamB?: string, eventName?: string, id?: string | number) => {
  const tA = teamA || 'team';
  const tB = teamB || 'match';
  const event = eventName || 'live-event';
  
  const rawString = `${tA}-vs-${tB}-${event}`;
  
  const cleanSlug = rawString
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') 
    .replace(/^-+|-+$/g, '');    

  return `${cleanSlug}-${id || '0'}`;
};

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
        <span className="text-gray-500 text-xs font-bold tracking-wide uppercase px-2 py-0.5 bg-gray-800/80 rounded-md">Ended</span>
      </div>
    );
  }

  if (status === 'live') {
    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">((•))</span>
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
  const dateStr = startTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); 

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="text-gray-300 text-[13px] font-semibold tracking-wide">{timeStr}</div>
      <div className="text-[#00E5FF] text-[11px] font-semibold mt-0.5">{dateStr}</div>
      
      {diffHours > 0 ? (
        <div className="text-gray-400 text-[10px] mt-2 font-medium whitespace-nowrap">
          Starting in <span className="text-gray-300 font-bold">{diffHours}h {diffMins}m</span>
        </div>
      ) : (
        <div className="text-amber-400 text-[11px] mt-2 font-bold whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">
          In {diffMins}m {diffSecs}s
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

// 🟢 টিভি চ্যানেলের জন্য প্রিমিয়াম লোডিং স্কেলিটন
function ChannelSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 animate-pulse snap-center">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gray-800/80 border-2 border-gray-700/50"></div>
      <div className="w-12 h-2 bg-gray-800 rounded mt-1"></div>
    </div>
  );
}

const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || {};
  const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link 
        href={`/watch/${slugLink}`} 
        className="outline-none rounded-[20px] focus:outline-none group block content-visibility-auto contain-intrinsic-size-[180px]"
        prefetch={false}
      >
        <div className="bg-[#1C1E2B] border border-gray-800/80 rounded-[20px] p-5 transition-all duration-300 transform group-hover:border-[#00E5FF]/60 group-hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] group-focus:border-[#00E5FF] active:scale-[0.98] active:border-[#00E5FF] flex flex-col justify-between h-full min-h-[160px]">
          
          {(eventInfo.eventCat || eventInfo.eventName) && (
            <div className="text-[12px] md:text-[13px] text-gray-400 font-semibold mb-5 flex items-center justify-center gap-2 uppercase tracking-wider">
              {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
                <div className="relative w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Image 
                    src={getImg(eventInfo.eventLogo)} 
                    alt="League Logo" 
                    fill
                    sizes="16px"
                    className="object-contain rounded-full"
                    unoptimized
                  />
                </div>
              )}
              <span className="truncate max-w-[250px] group-hover:text-gray-200 transition-colors">
                {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' • ')}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center mt-auto">
            <div className="flex flex-col items-center gap-2.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-14 md:h-14 bg-black/40 border border-gray-700/50 rounded-full flex items-center justify-center overflow-hidden p-0.5 group-hover:border-[#00E5FF]/30 transition-colors">
                <Image src={getImg(eventInfo.teamAFlag)} alt={eventInfo.teamA || 'Team A'} fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized />
              </div>
              <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center group-hover:text-white transition-colors">{eventInfo.teamA || 'Team A'}</span>
            </div>

            <div className="w-[40%] flex justify-center items-center">
              <MatchCountdown startTimeStr={eventInfo.startTime} endTimeStr={eventInfo.endTime} status={status} />
            </div>

            <div className="flex flex-col items-center gap-2.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-14 md:h-14 bg-black/40 border border-gray-700/50 rounded-full flex items-center justify-center overflow-hidden p-0.5 group-hover:border-[#00E5FF]/30 transition-colors">
                <Image src={getImg(eventInfo.teamBFlag)} alt={eventInfo.teamB || 'Team B'} fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized />
              </div>
              <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center group-hover:text-white transition-colors">{eventInfo.teamB || 'Team B'}</span>
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return prevProps.match.id === nextProps.match.id && prevProps.status === nextProps.status;
});
MatchCard.displayName = 'MatchCard';

function MatchSkeleton() {
  return (
    <div className="bg-[#1C1E2B] border border-gray-800/60 rounded-[20px] p-5 animate-pulse flex flex-col gap-5 h-[160px]">
      <div className="h-3 bg-gray-800 rounded w-2/3 mx-auto mt-2"></div>
      <div className="flex justify-between items-center px-2 mt-auto">
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
  
  // 🟢 টিভি চ্যানেলের ডাটা ফেচ করা হচ্ছে
  const { data: channelData, error: channelError } = useSWR('/api/channels', fetcher, { refreshInterval: 60000 });
  const channels = channelData?.channels || [];

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
    { id: 'Live', label: `Live (${stats.live})`, icon: '🔴' },
    { id: 'Upcoming', label: `Upcoming (${stats.upcoming})`, icon: '⏳' },
    { id: 'Recent', label: `Recent (${stats.recent})`, icon: '✅' }
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
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20 tv:p-8">
      
      <motion.nav 
        initial={{ y: -50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        transition={{ duration: 0.4 }}
        className="p-4 bg-[#11131A]/90 sticky top-0 z-50 flex items-center justify-between border-b border-gray-800/60 backdrop-blur-md max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl md:text-2xl font-black text-[#00E5FF] tracking-wide uppercase tv:text-3xl drop-shadow-[0_0_10px_rgba(0,229,255,0.3)]">All In One Sports</h1>
        </div>

        <div className="flex items-center gap-3 w-full max-w-xs justify-end">
          {showSearch && (
            <motion.input 
              initial={{ width: 0, opacity: 0 }} 
              animate={{ width: '100%', opacity: 1 }} 
              transition={{ duration: 0.3 }}
              type="text" 
              placeholder="Search match or event..." 
              value={searchInp}
              onChange={(e) => setSearchInp(e.target.value)}
              className="bg-[#1C1E2B] border border-[#00E5FF]/40 text-sm rounded-xl px-4 py-2 w-full focus:outline-none focus:border-[#00E5FF] focus:ring-1 focus:ring-[#00E5FF]/50 transition-all text-white placeholder-gray-500 shadow-inner"
              autoFocus
            />
          )}
          <button 
            onClick={() => { setShowSearch(!showSearch); setSearchInp(''); setDebouncedSearch(''); }} 
            className="outline-none text-gray-300 hover:text-[#00E5FF] focus:text-[#00E5FF] p-1 rounded-full hover:bg-white/5 transition-colors"
            aria-label="Toggle Search"
          >
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
        transition={{ duration: 0.5, delay: 0.1 }}
        className="max-w-7xl mx-auto px-4 mt-2"
      >
        
        {/* 🟢 Live Sports TV Section (Horizontal Scroll) */}
        {(!channelData && !channelError) && (
          <div className="mb-6 mt-4">
            <h2 className="text-xs md:text-sm font-black text-gray-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-600 animate-pulse"></span> Loading TV...
            </h2>
            <div className="flex items-center gap-4 overflow-hidden py-2">
              <ChannelSkeleton /><ChannelSkeleton /><ChannelSkeleton /><ChannelSkeleton /><ChannelSkeleton />
            </div>
          </div>
        )}

        {channels && channels.length > 0 && (
          <div className="mb-4 mt-4">
            <h2 className="text-xs md:text-sm font-black text-[#00E5FF] uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
              <span className="text-red-500 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">●</span> Live Sports TV
            </h2>
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide py-2 snap-x">
              {channels.map((ch: any) => (
                <Link key={ch.id} href={`/tv/${ch.id}`} className="snap-center group outline-none" prefetch={false}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#1C1E2B] border-2 border-gray-800 flex items-center justify-center p-1 group-hover:border-[#00E5FF] group-hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all duration-300 active:scale-95 overflow-hidden relative">
                      <Image 
                        src={getImg(ch.logo)} 
                        alt={ch.name} 
                        fill
                        sizes="(max-width: 768px) 64px, 80px"
                        className="object-cover rounded-full p-0.5" 
                        unoptimized 
                      />
                    </div>
                    <span className="text-[10px] md:text-xs font-bold text-gray-400 group-hover:text-white truncate w-16 md:w-20 text-center transition-colors tracking-wide">
                      {ch.name}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Categories Section */}
        <div className="flex items-center justify-start gap-5 md:gap-8 py-6 mb-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x border-t border-gray-800/50">
          {dynamicCategories.map((cat, i) => (
            <motion.button 
              key={cat} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => setActiveCategory(cat)} 
              className="flex flex-col items-center gap-2 cursor-pointer outline-none group min-w-[65px] snap-center focus:outline-none"
            >
              <div className={`w-[60px] h-[60px] md:w-[70px] md:h-[70px] rounded-full flex items-center justify-center transition-all duration-300 transform group-focus:scale-110 group-focus:ring-2 group-focus:ring-[#00E5FF]/50 ${
                activeCategory === cat ? 'bg-[#1C1E2B] border-2 border-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.4)]' : 'bg-[#1C1E2B] border border-gray-700/50 text-gray-400 group-hover:border-gray-500 group-hover:bg-gray-800/40'
              }`}>
                {getCategoryIcon(cat)}
              </div>
              <span className={`text-[12px] font-bold transition-colors ${activeCategory === cat ? 'text-[#00E5FF]' : 'text-gray-400 group-hover:text-gray-200'} truncate max-w-[75px]`}>{cat}</span>
            </motion.button>
          ))}
        </div>

        {/* Filters Section */}
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide mb-8 py-1 snap-x">
          {filters.map((filter, i) => (
            <motion.button
              key={filter.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 + 0.1 }}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-5 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all border snap-center focus:outline-none flex items-center gap-1.5 ${
                activeFilter === filter.id
                  ? "bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)] ring-1 ring-[#00E5FF]/30"
                  : "bg-[#1C1E2B] border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
              }`}
            >
              {filter.icon && <span className="text-[10px] md:text-xs">{filter.icon}</span>}
              {filter.label}
            </motion.button>
          ))}
        </div>

        {/* Error State */}
        {error && <div className="text-center py-10 text-red-400 font-medium bg-red-500/10 rounded-2xl border border-red-500/20">Failed to load live match data. Please refresh the page.</div>}
        
        {/* Loading Skeleton */}
        {!matches && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
          </div>
        )}

        {/* Empty State */}
        {matches && processedMatches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 font-semibold bg-[#1C1E2B] rounded-[20px] border border-gray-800/40">
            <span className="text-4xl mb-3">🕵️‍♂️</span>
            <p>No matches available for this category or search.</p>
          </div>
        )}

        {/* Match Grid */}
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
