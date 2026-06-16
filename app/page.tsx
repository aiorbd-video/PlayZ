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
  if (!url || url === "null" || url === "Null") return "/fallback-logo.png";
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
  const cleanSlug = rawString.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');    
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
    return <div className="flex flex-col items-center justify-center"><span className="text-gray-500 text-xs font-bold uppercase px-2 py-0.5 bg-gray-800/80 rounded-md">Ended</span></div>;
  }
  if (status === 'live') {
    return <div className="flex flex-col items-center justify-center gap-1"><span className="text-red-500 text-lg animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">((•))</span><span className="text-red-500 text-xs font-bold uppercase">Live</span></div>;
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
        <div className="text-gray-400 text-[10px] mt-2 font-medium whitespace-nowrap">Starting in <span className="text-gray-300 font-bold">{diffHours}h {diffMins}m</span></div>
      ) : (
        <div className="text-amber-400 text-[11px] mt-2 font-bold whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">In {diffMins}m {diffSecs}s</div>
      )}
    </div>
  );
});
MatchCountdown.displayName = 'MatchCountdown';

const getCategoryIcon = (cat: string) => {
  if (cat === 'Live Events') return <span className="text-xl">🏟️</span>;
  if (cat === 'Sports') return <span className="text-2xl animate-pulse">📺</span>;
  if (cat === 'M3U') return <span className="text-2xl animate-pulse">📡</span>;
  const lowerCat = cat.toLowerCase();
  if (lowerCat.includes('cricket')) return <span className="text-2xl">🏏</span>;
  if (lowerCat.includes('football')) return <span className="text-2xl">⚽</span>;
  if (lowerCat.includes('wwe') || lowerCat.includes('wrestling')) return <span className="text-2xl">🤼</span>;
  if (lowerCat.includes('racing') || lowerCat.includes('formula')) return <span className="text-2xl">🏎️</span>;
  return <span className="text-2xl">🏆</span>;
};

// 🟢 কাস্টম চ্যানেল ও M3U এর জন্য কার্ড
const ChannelCard = memo(({ channel }: { channel: any }) => {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} whileTap={{ scale: 0.95 }}>
      <Link href={`/tv/${channel.id}`} className="outline-none block" prefetch={false}>
        <div className="bg-[#1C1E2B] border border-gray-800/80 rounded-[20px] p-5 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] active:border-[#00E5FF] h-full min-h-[140px] group">
          <div className="w-16 h-16 rounded-full bg-black/40 border border-gray-700/50 p-1 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110">
            <Image src={getImg(channel.logo)} alt={channel.name} width={60} height={60} className="object-contain rounded-full" unoptimized />
          </div>
          <span className="font-bold text-sm text-gray-200 group-hover:text-white text-center truncate w-full">{channel.name}</span>
          <span className="text-[10px] px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full animate-pulse tracking-widest uppercase font-bold">Watch</span>
        </div>
      </Link>
    </motion.div>
  );
});
ChannelCard.displayName = 'ChannelCard';

// 🟢 লাইভ ম্যাচের জন্য কার্ড
const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || {};
  const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} whileTap={{ scale: 0.97 }}>
      <Link href={`/watch/${slugLink}`} className="outline-none rounded-[20px] block" prefetch={false}>
        <div className="bg-[#1C1E2B] border border-gray-800/80 rounded-[20px] p-5 transition-all duration-300 hover:border-[#00E5FF]/60 hover:shadow-[0_4px_20px_rgba(0,229,255,0.1)] flex flex-col justify-between h-full min-h-[160px] group">
          {(eventInfo.eventCat || eventInfo.eventName) && (
            <div className="text-[12px] md:text-[13px] text-gray-400 font-semibold mb-5 flex items-center justify-center gap-2 uppercase tracking-wider">
              {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
                <div className="relative w-4 h-4 opacity-80 group-hover:opacity-100"><Image src={getImg(eventInfo.eventLogo)} alt="League Logo" fill sizes="16px" className="object-contain rounded-full" unoptimized /></div>
              )}
              <span className="truncate max-w-[250px] group-hover:text-gray-200 transition-colors">{[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' • ')}</span>
            </div>
          )}
          <div className="flex justify-between items-center mt-auto">
            <div className="flex flex-col items-center gap-2.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-14 md:h-14 bg-black/40 border border-gray-700/50 rounded-full flex items-center justify-center overflow-hidden p-0.5 group-hover:border-[#00E5FF]/30"><Image src={getImg(eventInfo.teamAFlag)} alt={eventInfo.teamA || 'Team A'} fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized /></div>
              <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center group-hover:text-white">{eventInfo.teamA || 'Team A'}</span>
            </div>
            <div className="w-[40%] flex justify-center items-center"><MatchCountdown startTimeStr={eventInfo.startTime} endTimeStr={eventInfo.endTime} status={status} /></div>
            <div className="flex flex-col items-center gap-2.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-14 md:h-14 bg-black/40 border border-gray-700/50 rounded-full flex items-center justify-center overflow-hidden p-0.5 group-hover:border-[#00E5FF]/30"><Image src={getImg(eventInfo.teamBFlag)} alt={eventInfo.teamB || 'Team B'} fill sizes="(max-width: 768px) 48px, 56px" className="object-cover rounded-full" unoptimized /></div>
              <span className="font-bold text-xs md:text-sm text-gray-200 truncate w-full text-center group-hover:text-white">{eventInfo.teamB || 'Team B'}</span>
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
      <div className="h-3 bg-gray-800 rounded w-2/3 mx-auto mt-2"></div>
      <div className="flex justify-between items-center px-2 mt-auto">
        <div className="w-12 h-12 rounded-full bg-gray-800"></div>
        <div className="w-16 h-8 bg-gray-800 rounded"></div>
        <div className="w-12 h-12 rounded-full bg-gray-800"></div>
      </div>
    </div>
  );
}

// ==========================================
// 🛑 ১ম অংশ শেষ। এরপর থেকে ২য় অংশ শুরু হবে!
// ==========================================
