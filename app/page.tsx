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
  if (!url || url === "null" || url === "Null" || url === "") return "/fallback-logo.png";
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
  return `${rawString.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${id || '0'}`;
};

// 🟢 হুবহু অ্যাপের মত কাউন্টডাউন ও স্ট্যাটাস
const MatchCountdown = memo(({ startTimeStr, endTimeStr, status }: { startTimeStr: string, endTimeStr: string, status: string }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startTime = startTimeStr ? new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')) : null;

  if (status === 'recent') {
    return <div className="text-gray-400 text-xs font-bold uppercase mt-2">Match Ended</div>;
  }

  if (status === 'live') {
    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg animate-pulse">((•))</span>
        <span className="text-red-500 text-[10px] md:text-xs font-bold tracking-wide uppercase">Live</span>
      </div>
    );
  }

  if (!startTime) return <span className="text-gray-400 font-bold text-xs">TBA</span>;
  
  const diffMs = startTime.getTime() - time.getTime();
  if (diffMs <= 0) return <span className="text-green-500 font-bold text-xs animate-pulse">Starting...</span>;
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); 

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="text-gray-200 text-sm font-bold tracking-wide">{timeStr}</div>
      <div className="text-[#00E5FF] text-[10px] font-bold mt-0.5">{dateStr}</div>
      <div className="text-gray-300 text-[10px] mt-2 font-semibold">
        Match Starting in {diffHours > 0 ? `${diffHours} Hours` : `${diffMins} Minutes`}
      </div>
    </div>
  );
});
MatchCountdown.displayName = 'MatchCountdown';

// 🟢 ক্যাটাগরি আইকন (অ্যাপের মত)
const getCategoryIcon = (cat: string) => {
  if (cat === 'All') return "🎧";
  const lowerCat = cat.toLowerCase();
  if (lowerCat.includes('cricket')) return "🏏";
  if (lowerCat.includes('football')) return "⚽";
  if (lowerCat.includes('wwe') || lowerCat.includes('wrestling')) return "🤼";
  if (lowerCat.includes('racing') || lowerCat.includes('formula')) return "🏎️";
  if (lowerCat.includes('hockey')) return "🏑";
  if (lowerCat.includes('basketball')) return "🏀";
  return "🏆";
};

// 🟢 ৪-কলামের স্কয়ার চ্যানেল কার্ড (Image 2 & 3 এর মত)
const ChannelCard = memo(({ channel, isPlaylist }: { channel: any, isPlaylist?: boolean }) => {
  const linkHref = isPlaylist ? `/playlist/${channel.id}` : `/tv/${channel.id}`;

  return (
    <motion.div whileTap={{ scale: 0.95 }}>
      <Link href={linkHref} className="outline-none block" prefetch={false}>
        <div className="bg-[#1C1E2B] border border-[#2A8496]/50 rounded-xl p-2 flex flex-col items-center justify-center aspect-[4/5] hover:border-[#00E5FF] transition-colors relative overflow-hidden">
          <div className="w-[50px] h-[50px] sm:w-[60px] sm:h-[60px] rounded-full bg-white flex items-center justify-center overflow-hidden mb-2 shadow-inner border border-gray-300">
            <Image src={getImg(channel.logo)} alt={channel.name} width={50} height={50} className="object-contain p-1" unoptimized />
          </div>
          <span className="font-semibold text-[10px] sm:text-xs text-gray-200 text-center truncate w-full px-1">{channel.name}</span>
        </div>
      </Link>
    </motion.div>
  );
});
ChannelCard.displayName = 'ChannelCard';

// 🟢 হুবহু অ্যাপের মত লাইভ ম্যাচ কার্ড (Image 1 এর মত)
const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || {};
  const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }}>
      <Link href={`/watch/${slugLink}`} className="outline-none block mb-3" prefetch={false}>
        <div className="bg-[#1C1E2B] border border-[#2A8496]/70 rounded-[16px] p-3 transition-colors hover:border-[#00E5FF]">
          
          {/* Top Row: League Info */}
          {(eventInfo.eventCat || eventInfo.eventName) && (
            <div className="flex items-center justify-center gap-1.5 mb-3 border-b border-gray-800/50 pb-2">
              {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
                <div className="relative w-4 h-4 bg-white rounded-full overflow-hidden flex-shrink-0">
                  <Image src={getImg(eventInfo.eventLogo)} alt="Logo" fill className="object-contain p-0.5" unoptimized />
                </div>
              )}
              <span className="text-[11px] text-gray-300 font-semibold truncate max-w-[90%] uppercase">
                {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' | ')}
              </span>
            </div>
          )}

          {/* Middle Row: Teams & Score/Time */}
          <div className="flex justify-between items-center px-2">
            {/* Team A */}
            <div className="flex flex-col items-center gap-1 w-[30%]">
              <div className="relative w-10 h-10 rounded-full bg-white overflow-hidden border border-gray-400 shadow-sm">
                <Image src={getImg(eventInfo.teamAFlag)} alt={eventInfo.teamA || 'Team A'} fill className="object-cover" unoptimized />
              </div>
              <span className="font-bold text-[10px] sm:text-xs text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamA || 'Team A'}</span>
            </div>

            {/* Center: Time or Live */}
            <div className="w-[40%] flex flex-col justify-center items-center">
              <MatchCountdown startTimeStr={eventInfo.startTime} endTimeStr={eventInfo.endTime} status={status} />
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center gap-1 w-[30%]">
              <div className="relative w-10 h-10 rounded-full bg-white overflow-hidden border border-gray-400 shadow-sm">
                <Image src={getImg(eventInfo.teamBFlag)} alt={eventInfo.teamB || 'Team B'} fill className="object-cover" unoptimized />
              </div>
              <span className="font-bold text-[10px] sm:text-xs text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamB || 'Team B'}</span>
            </div>
          </div>

        </div>
      </Link>
    </motion.div>
  );
}, (prevProps, nextProps) => prevProps.match.id === nextProps.match.id && prevProps.status === nextProps.status);
MatchCard.displayName = 'MatchCard';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'Sports' | 'Live Events' | 'Categories'>('Live Events');
  const [activeCategory, setActiveCategory] = useState('All'); 
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchInp, setSearchInp] = useState('');
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const { data: matches } = useSWR(MATCH_API, fetcher, { refreshInterval: 30000 });
  const { data: channelData } = useSWR('/api/channels', fetcher, { refreshInterval: 60000 });
  const { data: m3uData } = useSWR('/api/m3u', fetcher, { refreshInterval: 60000 });
  
  const channels = channelData?.channels || [];
  const m3uChannels = m3uData?.channels || [];

  // Live Events Categories
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
    { id: 'All', label: `All (${stats.all})`, icon: '✓' },
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
      
      if (searchInp.trim() !== '') {
        const query = searchInp.toLowerCase();
        return ((eventInfo.teamA || '').toLowerCase().includes(query) || (eventInfo.teamB || '').toLowerCase().includes(query) || (eventInfo.eventName || '').toLowerCase().includes(query));
      }
      return true;
    }).sort((a: any, b: any) => {
      const aStart = new Date(a.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
      const bStart = new Date(b.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
      if (activeFilter === 'All') {
        const aStatus = getMatchStatus(a.eventInfo?.startTime, a.eventInfo?.endTime, currentTime);
        const bStatus = getMatchStatus(b.eventInfo?.startTime, b.eventInfo?.endTime, currentTime);
        const priority: any = { live: 1, upcoming: 2, recent: 3 };
        if (priority[aStatus] !== priority[bStatus]) return priority[aStatus] - priority[bStatus];
        if (aStatus === 'upcoming') return aStart - bStart; 
        return 0;
      }
      return aStart - bStart;
    });
  }, [matches, activeCategory, activeFilter, searchInp, currentTime]);

  const filteredChannels = channels.filter((ch: any) => ch.name.toLowerCase().includes(searchInp.toLowerCase()));
  const filteredM3uChannels = m3uChannels.filter((ch: any) => ch.name.toLowerCase().includes(searchInp.toLowerCase()));

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#11131A] text-gray-200 font-sans pb-24 selection:bg-[#00E5FF] selection:text-black">
      
      {/* 🟢 Top Header (Fixed) */}
      <nav className="bg-[#1C1E2B] sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-[#2A8496]/30 shadow-md">
        <div className="flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          <h1 className="text-xl font-semibold text-gray-100">{activeTab === 'Live Events' ? 'GHD Sports' : activeTab}</h1>
        </div>
        <div className="flex items-center gap-4 text-gray-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </nav>

      {/* 🟢 Search Input (Global) */}
      <div className="px-4 py-3">
        <input 
          type="text" 
          placeholder="Search..." 
          value={searchInp}
          onChange={(e) => setSearchInp(e.target.value)}
          className="w-full bg-[#1C1E2B] border border-gray-700/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#00E5FF] text-white"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4">
        
        {/* =========================================
            TAB 1: LIVE EVENTS (Matches)
        =========================================== */}
        {activeTab === 'Live Events' && (
          <>
            {/* Top Categories Scroll (All, Cricket, Football...) */}
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide pb-4 pt-2 snap-x">
              {dynamicCategories.map((cat) => (
                <button key={cat} onClick={() => { setActiveCategory(cat); setActiveFilter('All'); }} className="flex flex-col items-center gap-1 min-w-[50px] snap-center outline-none group">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all border ${activeCategory === cat ? 'border-[#00E5FF] bg-[#1C1E2B] shadow-[0_0_10px_rgba(0,229,255,0.3)]' : 'border-gray-700 bg-[#1C1E2B] group-hover:border-gray-500'}`}>
                    {getCategoryIcon(cat)}
                  </div>
                  <span className={`text-[10px] font-semibold ${activeCategory === cat ? 'text-white' : 'text-gray-400'}`}>{cat}</span>
                </button>
              ))}
            </div>

            {/* Filter Pills (All, Live, Recent, Upcoming) */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-4 mb-2">
              {filters.map((f) => (
                <button key={f.id} onClick={() => setActiveFilter(f.id)} className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 border ${activeFilter === f.id ? 'bg-[#1C1E2B] border-[#00E5FF] text-white' : 'bg-transparent border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'}`}>
                  {f.id === 'All' && activeFilter === 'All' && <span className="text-[#00E5FF]">✓</span>}
                  {f.label}
                </button>
              ))}
            </div>

            {/* Match List */}
            {!matches ? (
              <div className="animate-pulse space-y-3"><div className="h-32 bg-[#1C1E2B] rounded-xl border border-gray-800"></div><div className="h-32 bg-[#1C1E2B] rounded-xl border border-gray-800"></div></div>
            ) : processedMatches.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">No matches found.</div>
            ) : (
              <div className="flex flex-col gap-0">
                {processedMatches.map((match: any) => (
                  <MatchCard key={match.id} match={match} status={getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, currentTime)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* =========================================
            TAB 2: SPORTS (Custom Channels)
        =========================================== */}
        {activeTab === 'Sports' && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 pt-2">
            {filteredChannels.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">No channels found.</div>}
            {filteredChannels.map((ch: any) => <ChannelCard key={ch.id} channel={ch} />)}
          </div>
        )}

        {/* =========================================
            TAB 3: CATEGORIES (M3U Playlists)
        =========================================== */}
        {activeTab === 'Categories' && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 pt-2">
            {filteredM3uChannels.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">No categories found.</div>}
            {filteredM3uChannels.map((ch: any) => <ChannelCard key={ch.id} channel={ch} isPlaylist={true} />)}
          </div>
        )}

      </div>

      {/* 🟢 Bottom Navigation Bar (Fixed) */}
      <div className="fixed bottom-0 left-0 w-full bg-[#1C1E2B] border-t border-gray-800/80 pb-safe z-50">
        <div className="max-w-md mx-auto flex justify-between items-center h-[60px] px-6">
          
          <button onClick={() => { setActiveTab('Sports'); setSearchInp(''); }} className={`flex flex-col items-center justify-center w-16 gap-1 outline-none transition-colors ${activeTab === 'Sports' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <div className={`p-1.5 rounded-full ${activeTab === 'Sports' ? 'bg-[#2A2D3E]' : 'bg-transparent'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-semibold">Sports</span>
          </button>

          <button onClick={() => { setActiveTab('Live Events'); setSearchInp(''); }} className={`flex flex-col items-center justify-center w-20 gap-1 outline-none transition-colors ${activeTab === 'Live Events' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <div className={`p-1.5 rounded-full px-4 ${activeTab === 'Live Events' ? 'bg-[#3A3C52]' : 'bg-transparent'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.521 14.279l-1.042-1.042M18.479 14.279l1.042-1.042M8.343 11.457l-1.042-1.042M15.657 11.457l1.042-1.042M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>
            </div>
            <span className="text-[10px] font-semibold">Live Events</span>
          </button>

          <button onClick={() => { setActiveTab('Categories'); setSearchInp(''); }} className={`flex flex-col items-center justify-center w-16 gap-1 outline-none transition-colors ${activeTab === 'Categories' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
             <div className={`p-1.5 rounded-full ${activeTab === 'Categories' ? 'bg-[#2A2D3E]' : 'bg-transparent'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-[10px] font-semibold">Categories</span>
          </button>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </main>
  );
}
