'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

// .env থেকে লিংকগুলো টানা হলো
// সরাসরি আমাদের বানানো Next.js প্রক্সি লিংক
const CAT_API = "/api/proxy-cats";
const MATCH_API = "/api/proxy-matches";

// ইমেজ প্রক্সি আগের মতোই থাকবে
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";


const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ==========================================
// 🧩 মডিউল ১: হেল্পার ফাংশন (টাইম ও ইমেজ)
// ==========================================
const getImg = (url: string) => (url && url !== "null" ? `${IMG_PROXY}${url}` : "");

const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return { text: "TBA", type: "upcoming" };

  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));

  if (currentTime > endTime) {
    return { text: "Match Ended", type: "ended" };
  } else if (currentTime >= startTime && currentTime <= endTime) {
    return { text: "🔴 LIVE NOW", type: "live" };
  } else {
    const timeString = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateString = startTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { text: `🕒 ${dateString}, ${timeString}`, type: "upcoming" };
  }
};

// ==========================================
// 🧩 মডিউল ২: ম্যাচ কার্ড কম্পোনেন্ট
// ==========================================
const MatchCard = ({ match, currentTime }: { match: any, currentTime: Date }) => {
  const status = getMatchStatus(match.eventInfo.startTime, match.eventInfo.endTime, currentTime);

  return (
    <Link href={`/watch/${match.id}`}>
      <div className="bg-[#151C2C] border border-gray-800 rounded-2xl overflow-hidden hover:border-red-500/50 hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)] transition-all duration-300 group cursor-pointer flex flex-col h-full relative">
        
        {/* ইভেন্টের নাম ও লোগো */}
        <div className="bg-[#0B0F19]/50 p-3 flex items-center gap-3 border-b border-gray-800">
          <img src={getImg(match.eventInfo.eventLogo)} alt="Event" className="w-6 h-6 object-contain rounded-full bg-white/10" />
          <span className="text-xs text-gray-300 font-medium truncate">{match.eventInfo.eventName}</span>
        </div>

        {/* টিম ভার্সেস টিম */}
        <div className="p-6 flex-grow flex justify-between items-center relative">
          <div className="flex flex-col items-center w-[40%]">
            <div className="w-16 h-16 rounded-full bg-white/5 p-2 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <img src={getImg(match.eventInfo.teamAFlag)} alt={match.eventInfo.teamA} className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-bold text-center leading-tight line-clamp-2">{match.eventInfo.teamA}</span>
          </div>

          <div className="flex flex-col items-center justify-center w-[20%]">
            <span className="text-xs font-black text-gray-600 italic mb-1">VS</span>
          </div>

          <div className="flex flex-col items-center w-[40%]">
            <div className="w-16 h-16 rounded-full bg-white/5 p-2 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <img src={getImg(match.eventInfo.teamBFlag)} alt={match.eventInfo.teamB} className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-bold text-center leading-tight line-clamp-2">{match.eventInfo.teamB}</span>
          </div>
        </div>

        {/* লাইভ স্ট্যাটাস ও বাটন */}
        <div className="p-4 border-t border-gray-800 bg-[#0F1523] flex items-center justify-between mt-auto">
          <div className="text-xs font-bold uppercase tracking-wider">
            {status.type === 'live' && <span className="text-red-500 animate-pulse">{status.text}</span>}
            {status.type === 'upcoming' && <span className="text-blue-400">{status.text}</span>}
            {status.type === 'ended' && <span className="text-gray-500">{status.text}</span>}
          </div>
          <button className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
            status.type === 'live' ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}>
            {status.type === 'ended' ? 'Highlights' : 'Watch'}
          </button>
        </div>
      </div>
    </Link>
  );
};

// ==========================================
// 🧩 মডিউল ৩: মূল হোমপেজ (Main UI)
// ==========================================
export default function Home() {
  const [activeCat, setActiveCat] = useState("All");
  const [currentTime, setCurrentTime] = useState(new Date());

  // SWR দিয়ে .env লিংক থেকে ডাটা ফেচ
  const { data: categories } = useSWR(CAT_API || null, fetcher, { refreshInterval: 60000 });
  const { data: matches } = useSWR(MATCH_API || null, fetcher, { refreshInterval: 10000 });

  // প্রতি ১ মিনিটে রিয়েল-টাইম ঘড়ি আপডেট
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const filteredMatches = matches?.filter((match: any) => 
    activeCat === "All" ? true : match.eventInfo.eventCat === activeCat
  ) || [];

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white font-sans selection:bg-red-500 selection:text-white pb-20">
      
      {/* হেডার */}
      <header className="pt-10 pb-6 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent mb-2">
          Premium Sports Hub
        </h1>
        <p className="text-gray-400 text-sm md:text-base">Experience live sports like never before</p>
      </header>

      {/* ক্যাটাগরি স্লাইডার */}
      <section className="max-w-7xl mx-auto px-4 mb-8">
        <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-hide items-center justify-start md:justify-center">
          {!categories ? (
            <div className="text-gray-500 animate-pulse text-sm">Loading Categories...</div>
          ) : (
            categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.title)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full whitespace-nowrap transition-all duration-300 border ${
                  activeCat === cat.title
                    ? "bg-gradient-to-r from-red-600 to-red-500 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    : "bg-[#151C2C] border-gray-700 text-gray-300 hover:bg-gray-800"
                }`}
              >
                <img src={getImg(cat.image)} alt={cat.title} className="w-5 h-5 object-contain" />
                <span className="font-semibold text-sm">{cat.title}</span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* ম্যাচ গ্রিড */}
      <section className="max-w-7xl mx-auto px-4">
        {!matches ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-10 h-10 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-[#151C2C] rounded-2xl border border-gray-800">
            <span className="text-4xl mb-3 block">📭</span>
            No matches found for "{activeCat}" right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match: any) => (
              // ২য় মডিউল (MatchCard) এখানে কল করা হয়েছে
              <MatchCard key={match.id} match={match} currentTime={currentTime} />
            ))}
          </div>
        )}
      </section>

      {/* স্ক্রলবার হাইড করার CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </main>
  );
}
