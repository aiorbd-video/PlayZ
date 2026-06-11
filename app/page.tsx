'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const CAT_API = "/api/proxy-cats";
const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const getImg = (url: string) => (url && url !== "null" ? `${IMG_PROXY}${url}` : "");

const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return { type: "upcoming", time: "", date: "", label: "TBA" };

  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));

  const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (currentTime > endTime) {
    return { type: "ended", time: timeStr, date: dateStr, label: "Match Ended" };
  } else if (currentTime >= startTime && currentTime <= endTime) {
    return { type: "live", time: "", date: "", label: "Live" };
  } else {
    const diffMs = startTime.getTime() - currentTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    let label = "";
    if (diffDays > 0) label = `Starts in ${diffDays} days`;
    else if (diffHours > 0) label = `Match Starting in ${diffHours} Hours`;
    else label = "Starting Soon";

    return { type: "upcoming", time: timeStr, date: dateStr, label: label };
  }
};

export default function Home() {
  const [activeCat, setActiveCat] = useState("All");
  const [activeTab, setActiveTab] = useState("All");
  const [currentTime, setCurrentTime] = useState(new Date());

  const { data: categories } = useSWR(CAT_API, fetcher, { refreshInterval: 60000 });
  const { data: matches } = useSWR(MATCH_API, fetcher, { refreshInterval: 10000 });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const filteredMatches = matches?.filter((match: any) => {
    const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
    const catMatch = activeCat === "All" ? true : match.eventInfo.eventCat === activeCat;
    
    let tabMatch = true;
    if (activeTab === "Live") tabMatch = status.type === "live";
    if (activeTab === "Recent") tabMatch = status.type === "ended";
    if (activeTab === "Upcoming") tabMatch = status.type === "upcoming";

    return catMatch && tabMatch;
  }) || [];

  return (
    <main className="min-h-screen bg-[#12141c] text-white font-sans pb-20">
      
      {/* 🔝 Responsive Top Navbar */}
      <nav className="p-4 flex items-center justify-between bg-[#181a20] sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl w-full mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <svg className="w-6 h-6 text-gray-300 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            <h1 className="text-xl md:text-2xl font-semibold tracking-wide text-[#3498db]">GHD Sports Web</h1>
          </div>
          <div className="flex items-center gap-5 text-gray-300">
            <svg className="w-5 h-5 cursor-pointer hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            <svg className="w-5 h-5 cursor-pointer hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
      </nav>

      {/* 🏀 Circular Categories (Centered on Big Screens) */}
      <section className="bg-[#181a20] pt-4 pb-2 border-b border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto flex overflow-x-auto gap-6 px-4 scrollbar-hide md:justify-center">
          {!categories ? <div className="text-gray-500 animate-pulse text-sm">Loading...</div> : categories.map((cat: any) => (
            <button key={cat.id} onClick={() => setActiveCat(cat.title)} className="flex flex-col items-center gap-2 min-w-[70px] group outline-none">
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 transition-all ${
                activeCat === cat.title ? 'border-[#3498db] bg-[#1e2738] scale-105 shadow-md shadow-[#3498db]/20' : 'border-transparent bg-[#1e222d] group-hover:bg-[#252a38]'
              }`}>
                <img src={getImg(cat.image)} alt={cat.title} className="w-7 h-7 md:w-8 md:h-8 object-contain" />
              </div>
              <span className={`text-xs md:text-sm transition-colors ${activeCat === cat.title ? 'text-[#3498db] font-bold' : 'text-gray-400 group-hover:text-gray-200'}`}>{cat.title}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 🎛️ Sub-filters Tabs */}
      <section className="max-w-7xl mx-auto px-4 py-5 flex gap-3 overflow-x-auto scrollbar-hide md:justify-center">
        {['All', 'Live', 'Recent', 'Upcoming'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 md:px-6 md:py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 border outline-none ${
            activeTab === tab ? 'bg-[#1e2738] border-[#3498db] text-white' : 'bg-[#1a1e29] border-transparent text-gray-400 hover:text-white'
          }`}>
            {activeTab === tab && <span className="w-1.5 h-1.5 bg-[#3498db] rounded-full"></span>}
            {tab}
          </button>
        ))}
      </section>

      {/* 🏟️ Matches Responsive Grid (1 col on Mobile, 2 on Tablet, 3 on Desktop/TV) */}
      <section className="max-w-7xl mx-auto px-4 mt-2">
        {!matches ? (
          <div className="flex justify-center mt-10"><div className="w-8 h-8 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin"></div></div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-[#1a1e29] rounded-xl border border-gray-800">No matches found right now.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMatches.map((match: any) => {
              const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);
              
              return (
                <Link href={`/watch/${match.id}`} key={match.id} className="outline-none focus:ring-2 focus:ring-[#3498db] rounded-xl">
                  <div className="bg-[#1a1e29] border border-[#2d6a85]/50 hover:border-[#3498db] rounded-xl p-5 hover:bg-[#202533] transition-all duration-300 flex flex-col justify-between h-full group">
                    
                    <div>
                      {/* Top: Info */}
                      <div className="text-center text-[13px] text-gray-300 font-medium mb-5 flex items-center justify-center gap-2 border-b border-gray-800/50 pb-2">
                        <img src={getImg(match.eventInfo.eventLogo)} className="w-4 h-4 object-contain rounded-full" alt="" />
                        <span className="truncate">{match.eventInfo.eventCat} | {match.eventInfo.eventName}</span>
                      </div>

                      {/* Middle: Teams */}
                      <div className="flex justify-between items-center my-2">
                        <div className="flex flex-col items-center w-1/3">
                          <img src={getImg(match.eventInfo.teamAFlag)} alt={match.eventInfo.teamA} className="w-12 h-12 md:w-14 md:h-14 object-contain mb-2 rounded-full shadow-md" />
                          <span className="text-sm font-semibold text-gray-200 text-center line-clamp-1">{match.eventInfo.teamA}</span>
                        </div>

                        <div className="flex flex-col items-center justify-center w-1/3 text-center px-1">
                          {status.type === 'live' ? (
                            <div className="bg-red-600/10 border border-red-500/30 px-2 py-1 rounded flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                              <span className="text-red-500 text-[11px] font-black uppercase tracking-wider">{status.label}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="text-gray-100 font-bold text-sm md:text-base">{status.time}</span>
                              <span className="text-[#00b862] text-[11px] mt-1 font-bold">{status.date}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-center w-1/3">
                          <img src={getImg(match.eventInfo.teamBFlag)} alt={match.eventInfo.teamB} className="w-12 h-12 md:w-14 md:h-14 object-contain mb-2 rounded-full shadow-md" />
                          <span className="text-sm font-semibold text-gray-200 text-center line-clamp-1">{match.eventInfo.teamB}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Label */}
                    {status.type !== 'live' && (
                      <div className="text-center text-gray-400 text-xs mt-4 pt-2 border-t border-gray-800/30 font-medium group-hover:text-gray-300">
                        {status.label}
                      </div>
                    )}

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </main>
  );
}
