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

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);

  // প্রতি ১ মিনিটে টাইম আপডেট করবে রিয়েল-টাইম স্ট্যাটাসের জন্য
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: matches, error } = useSWR(MATCH_API, fetcher, { refreshInterval: 60000 });

  const categories = ['All', 'Cricket', 'Football', 'WWE'];
  const filters = ['All', 'Live', 'Recent', 'Upcoming'];

  // 🟢 ফিল্টারিং এবং সর্টিং লজিক (Magic Here!)
  const processedMatches = matches?.filter((match: any) => {
    // ১. ক্যাটাগরি ফিল্টার
    if (activeCategory !== 'All' && match.eventInfo.eventCat !== activeCategory) return false;
    
    // ২. স্ট্যাটাস ফিল্টার (Live/Recent/Upcoming)
    const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
    if (activeFilter === 'Live' && status !== 'live') return false;
    if (activeFilter === 'Recent' && status !== 'recent') return false;
    if (activeFilter === 'Upcoming' && status !== 'upcoming') return false;
    
    return true;
  }).sort((a: any, b: any) => {
    const aStart = new Date(a.eventInfo.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')).getTime();
    const bStart = new Date(b.eventInfo.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')).getTime();
    const aEnd = new Date(a.eventInfo.endTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')).getTime();
    const bEnd = new Date(b.eventInfo.endTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')).getTime();

    const aStatus = getMatchStatus(a.eventInfo.startTime, a.eventInfo.endTime, currentTime);
    const bStatus = getMatchStatus(b.eventInfo.startTime, b.eventInfo.endTime, currentTime);

    // 'All' ট্যাবের জন্য মাস্টার সর্টিং: Live > Upcoming > Recent
    if (activeFilter === 'All') {
      const priority: any = { live: 1, upcoming: 2, recent: 3 };
      if (priority[aStatus] !== priority[bStatus]) {
        return priority[aStatus] - priority[bStatus];
      }
      if (aStatus === 'upcoming') return aStart - bStart; // আপকামিং: যেটা আগে শুরু হবে সেটা ওপরে
      if (aStatus === 'recent') return bEnd - aEnd;       // রিসেন্ট: যেটা মাত্র শেষ হয়েছে সেটা ওপরে
      return 0;
    }

    if (activeFilter === 'Upcoming') return aStart - bStart;
    if (activeFilter === 'Recent') return bEnd - aEnd;

    return 0;
  });

  if (!mounted) return null; // Hydration Error ফিক্স

  return (
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-20">
      
      {/* 🔴 Top Header (All in one sports web) */}
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
        
        {/* ⚾ Category Circles */}
        <div className="flex items-center justify-around md:justify-start md:gap-10 py-4 mb-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <div key={cat} onClick={() => setActiveCategory(cat)} className="flex flex-col items-center gap-2 cursor-pointer outline-none group min-w-[70px]">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                activeCategory === cat ? 'bg-[#1e2738] border-2 border-[#3498db] shadow-lg shadow-[#3498db]/20' : 'bg-[#1a1e29] border border-gray-800 group-hover:bg-[#202533]'
              }`}>
                {cat === 'All' && <span className="text-xl font-bold text-[#3498db]">All</span>}
                {cat === 'Cricket' && <span className="text-2xl">🏏</span>}
                {cat === 'Football' && <span className="text-2xl">⚽</span>}
                {cat === 'WWE' && <span className="text-2xl">🤼‍♂️</span>}
              </div>
              <span className={`text-xs font-semibold ${activeCategory === cat ? 'text-[#3498db]' : 'text-gray-400'}`}>{cat}</span>
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
            const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
            const startTime = new Date(match.eventInfo.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
            const formattedTime = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            return (
              <Link href={`/watch/${match.id}`} key={match.id} className="outline-none" prefetch={false}>
                <div className="bg-[#1a1e29] border border-[#2d6a85]/20 rounded-2xl p-5 transition-all hover:bg-[#1e2433] hover:border-[#3498db]/40 shadow-sm relative overflow-hidden group">
                  
                  {/* Top: Category & Event Name */}
                  <div className="text-sm text-gray-300 font-medium mb-5 flex items-center justify-center gap-2">
                    <img src={getImg(match.eventInfo.eventLogo)} className="w-4 h-4 object-contain rounded-full" alt="" loading="lazy" />
                    <span className="truncate">{match.eventInfo.eventCat} | {match.eventInfo.eventName}</span>
                  </div>

                  {/* Bottom: Team VS Team Layout (hুবহু স্ক্রিনশটের মতো) */}
                  <div className="flex justify-between items-center px-2 md:px-8">
                    
                    {/* Team A */}
                    <div className="flex flex-col items-center gap-3 w-1/3">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-full p-0.5 bg-gray-800/50 shadow-inner group-hover:scale-105 transition-transform">
                         <img src={getImg(match.eventInfo.teamAFlag)} className="w-full h-full object-cover rounded-full" loading="lazy" />
                      </div>
                      <span className="font-bold text-sm md:text-base text-gray-100 truncate w-full text-center">{match.eventInfo.teamA}</span>
                    </div>

                    {/* Center: Status Badge */}
                    <div className="w-1/3 flex justify-center mt-[-20px]">
                      {status === 'live' && (
                        <span className="bg-red-500/10 text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg font-black text-xs tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                          <span className="w-2 h-2 bg-red-500 rounded-full animate-ping absolute opacity-75"></span>
                          <span className="w-2 h-2 bg-red-500 rounded-full relative"></span> LIVE
                        </span>
                      )}
                      {status === 'upcoming' && (
                        <span className="bg-[#1e2738] text-[#3498db] border border-[#2d6a85]/50 px-3 py-1.5 rounded-lg font-bold text-xs tracking-wider">
                          {formattedTime}
                        </span>
                      )}
                      {status === 'recent' && (
                        <span className="bg-[#252a38] text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg font-bold text-xs tracking-wider uppercase">
                          Ended
                        </span>
                      )}
                    </div>

                    {/* Team B */}
                    <div className="flex flex-col items-center gap-3 w-1/3">
                       <div className="w-14 h-14 md:w-16 md:h-16 rounded-full p-0.5 bg-gray-800/50 shadow-inner group-hover:scale-105 transition-transform">
                         <img src={getImg(match.eventInfo.teamBFlag)} className="w-full h-full object-cover rounded-full" loading="lazy" />
                       </div>
                      <span className="font-bold text-sm md:text-base text-gray-100 truncate w-full text-center">{match.eventInfo.teamB}</span>
                    </div>

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
