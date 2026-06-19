'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MATCH_API, fetcher, getMatchStatus, getCategoryIcon } from './utils/helpers';
import { ChannelCard, MatchCard } from './components/Cards';

// 📢 ১. ইনলাইন মারকুই নোটিশ কম্পোনেন্ট (React.createElement ফিক্স সহ)
function MarqueeNotice() {
  const { data } = useSWR('/api/notice', fetcher, { 
    refreshInterval: 30000,
    revalidateOnFocus: false 
  });

  if (!data || !data.notice || data.notice.trim() === "" || data.notice === "null") {
    return null;
  }

  return (
    <div className="w-full bg-[#1C1E2B] border-b border-gray-800/50 text-[#00E5FF] py-2 overflow-hidden flex items-center shadow-md">
      <div className="bg-red-500 text-white text-[11px] md:text-xs font-black px-3 py-1 rounded-r-md z-10 shrink-0 uppercase tracking-wider shadow-md animate-pulse">
        Notice
      </div>
      {/* 🟢 টাইপস্ক্রিপ্ট বাইপাস ফিক্স */}
      {require('react').createElement(
        'marquee',
        {
          behavior: 'scroll',
          direction: 'left',
          scrollamount: '5',
          className: 'text-xs md:text-sm font-bold tracking-wide pl-4',
        },
        data.notice
      )}
    </div>
  );
}


// --- Main Home Component ---
export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'Sports' | 'Live Events' | 'Categories'>('Live Events');
  const [activeCategory, setActiveCategory] = useState('All'); 
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchInp, setSearchInp] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'Live Events';
      if (tab === 'Sports' || tab === 'Live Events' || tab === 'Categories') {
        setActiveTab(tab as any);
      }
    };
    handlePopState(); 
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tab: 'Sports' | 'Live Events' | 'Categories') => {
    setActiveTab(tab);
    setSearchInp('');
    setShowSearch(false);
    router.push(`/?tab=${encodeURIComponent(tab)}`); 
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'All In One Reborn - Live Sports',
          url: window.location.href,
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.log('Share error', err);
    }
  };

  const { data: matches } = useSWR(MATCH_API, fetcher, { 
    refreshInterval: 30000,
    revalidateOnFocus: false,
    dedupingInterval: 15000
  });
  
  const { data: channelData } = useSWR('/api/channels', fetcher, { 
    refreshInterval: 60000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 20000
  });
  
  const { data: m3uData } = useSWR('/api/m3u', fetcher, { 
    refreshInterval: 90000,
    revalidateOnFocus: false,
    dedupingInterval: 30000
  });
  
  const channels = channelData?.channels || [];
  const m3uChannels = m3uData?.channels || [];

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
    <main className="min-h-screen bg-[#11131A] text-gray-200 font-sans pb-32 md:pb-12 selection:bg-[#00E5FF] selection:text-black">
      
      {/* Navbar Section */}
      <nav className="bg-[#1C1E2B] sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 border-b border-[#2A8496]/30 shadow-md h-16">
        {showSearch ? (
          <motion.div initial={{ opacity: 0, scaleX: 0.9 }} animate={{ opacity: 1, scaleX: 1 }} className="flex items-center w-full gap-3 origin-right">
            <input 
              type="text" 
              placeholder={`Search ${activeTab.toLowerCase()}...`} 
              value={searchInp}
              onChange={(e) => setSearchInp(e.target.value)}
              className="w-full bg-[#11131A] border border-[#00E5FF]/50 rounded-full px-5 py-2 text-sm focus:outline-none focus:border-[#00E5FF] text-white shadow-inner"
              autoFocus
            />
            <button onClick={() => { setShowSearch(false); setSearchInp(''); }} className="text-gray-400 hover:text-white text-sm font-semibold transition-colors">Cancel</button>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-bold text-[#00E5FF] tracking-wide uppercase">All In One Reborn</h1>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-[#11131A] p-1 rounded-full border border-gray-800/80 shadow-inner">
              <button onClick={() => handleTabChange('Sports')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'Sports' ? 'bg-[#2A2D3E] text-[#00E5FF] shadow-md' : 'text-gray-400 hover:text-gray-200'}`}>Sports</button>
              <button onClick={() => handleTabChange('Live Events')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'Live Events' ? 'bg-[#3A3C52] text-white shadow-md ring-1 ring-[#00E5FF]/50' : 'text-gray-400 hover:text-gray-200'}`}>Live Events</button>
              <button onClick={() => handleTabChange('Categories')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'Categories' ? 'bg-[#2A2D3E] text-[#00E5FF] shadow-md' : 'text-gray-400 hover:text-gray-200'}`}>Playlists</button>
            </div>

            <div className="flex items-center gap-4 text-gray-300">
              <svg onClick={handleShare} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 hover:text-[#00E5FF] cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              <svg onClick={() => setShowSearch(true)} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 hover:text-[#00E5FF] cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </>
        )}
      </nav>

      {/* 🎯 ২. প্লেসমেন্ট ফিক্স: নেভবারের ঠিক নিচে এবং মেইন গেম/চ্যানেল লিস্টের ঠিক ওপরে নোটিশটি বসানো হয়েছে */}
      <MarqueeNotice />

      {/* Main Content Layout */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-2">
        {activeTab === 'Live Events' && (
          <>
            <div className="flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-4 pt-2 snap-x">
              {dynamicCategories.map((cat) => (
                <button key={cat} onClick={() => { setActiveCategory(cat); setActiveFilter('All'); }} className="flex flex-col items-center gap-1.5 md:gap-2 min-w-[55px] md:min-w-[70px] snap-center outline-none group">
                  <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all border ${activeCategory === cat ? 'border-[#00E5FF] bg-[#1C1E2B] shadow-[0_0_15px_rgba(0,229,255,0.3)] scale-110' : 'border-gray-700 bg-[#1C1E2B] group-hover:border-gray-500 group-hover:bg-gray-800'}`}>
                    {getCategoryIcon(cat)}
                  </div>
                  <span className={`text-[10px] md:text-xs font-bold ${activeCategory === cat ? 'text-[#00E5FF]' : 'text-gray-400 group-hover:text-gray-200'}`}>{cat}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 md:gap-4 overflow-x-auto scrollbar-hide pb-5 mb-2 mt-2">
              {filters.map((f) => (
                <button key={f.id} onClick={() => setActiveFilter(f.id)} className={`px-5 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${activeFilter === f.id ? 'bg-[#1C1E2B] border-[#00E5FF] text-white shadow-[0_0_10px_rgba(0,229,255,0.2)]' : 'bg-[#11131A] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}`}>
                  {f.label}
                </button>
              ))}
            </div>

            {!matches ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {[1,2,3,4].map(i => <div key={i} className="h-40 bg-[#1C1E2B] rounded-2xl border border-gray-800 animate-pulse"></div>)}
              </div>
            ) : processedMatches.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-lg font-semibold bg-[#1C1E2B] rounded-2xl border border-gray-800/50">No matches found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
                {processedMatches.map((match: any) => (
                  <MatchCard key={match.id} match={match} status={getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, currentTime)} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'Sports' && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 md:gap-4 pt-4">
            {filteredChannels.length === 0 && <div className="col-span-full text-center py-20 text-gray-500 text-lg bg-[#1C1E2B] rounded-2xl">No channels found.</div>}
            {filteredChannels.map((ch: any) => <ChannelCard key={ch.id} channel={ch} />)}
          </div>
        )}

        {activeTab === 'Categories' && (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 md:gap-4 pt-4">
            {filteredM3uChannels.length === 0 && <div className="col-span-full text-center py-20 text-gray-500 text-lg bg-[#1C1E2B] rounded-2xl">No categories found.</div>}
            {filteredM3uChannels.map((ch: any) => <ChannelCard key={ch.id} channel={ch} isPlaylist={true} />)}
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-[#1C1E2B] border-t border-gray-800/80 pb-safe z-[60]">
        <div className="max-w-md mx-auto flex justify-between items-center h-[60px] px-6 relative">
          <button onClick={() => handleTabChange('Sports')} className={`flex flex-col items-center justify-center w-16 gap-1 outline-none transition-colors ${activeTab === 'Sports' ? 'text-[#00E5FF]' : 'text-gray-500 hover:text-gray-300'}`}>
            <div className={`p-1.5 rounded-full ${activeTab === 'Sports' ? 'bg-[#2A2D3E] shadow-inner' : 'bg-transparent'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <span className="text-[10px] font-bold">Sports</span>
          </button>

          <button onClick={() => handleTabChange('Live Events')} className={`flex flex-col items-center justify-center w-20 gap-1 outline-none transition-colors ${activeTab === 'Live Events' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
            <div className={`p-1.5 rounded-full px-4 ${activeTab === 'Live Events' ? 'bg-[#3A3C52] border border-[#2A8496]/50' : 'bg-transparent'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.521 14.279l-1.042-1.042M18.479 14.279l1.042-1.042M8.343 11.457l-1.042-1.042M15.657 11.457l1.042-1.042M12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>
            </div>
            <span className="text-[10px] font-bold">Live Events</span>
          </button>

          <button onClick={() => handleTabChange('Categories')} className={`flex flex-col items-center justify-center w-16 gap-1 outline-none transition-colors ${activeTab === 'Categories' ? 'text-[#00E5FF]' : 'text-gray-500 hover:text-gray-300'}`}>
             <div className={`p-1.5 rounded-full ${activeTab === 'Categories' ? 'bg-[#2A2D3E] shadow-inner' : 'bg-transparent'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <span className="text-[10px] font-bold">Categories</span>
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        a[href*="t.me"], a[href*="telegram"], .telegram-widget, .floating-btn { bottom: 85px !important; z-index: 50 !important; }
      `}} />
    </main>
  );
}
