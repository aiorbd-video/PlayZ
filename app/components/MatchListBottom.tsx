'use client';

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import useSWR from 'swr';

const LIVE_EVENTS_API = "https://ratulxadia-playz-cats-event.hf.space/api/events";
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());
const IMG_PROXY = "https://img.aiorbd.workers.dev/?url=";

const generateSlug = (teamA: string, teamB: string, eventName: string, id: string | number) => {
  const clean = (text: string) => {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };
  return `${clean(teamA || 'team-a')}-vs-${clean(teamB || 'team-b')}-${id}`;
};

const SmartImage = memo(({ src, alt, fill, width, height, className }: any) => {
  const originalSrc = (!src || src === "null" || src === "Null" || src === "") ? "/fallback-logo.png" : src;
  const [imgSrc, setImgSrc] = useState(originalSrc);
  const [errorCount, setErrorCount] = useState(0);

  const imageProps = fill ? { fill: true } : { width: width || 80, height: height || 80 };

  return (
    <Image
      src={imgSrc}
      alt={alt || "Logo"}
      className={className}
      unoptimized
      onError={() => {
        if (errorCount === 0 && originalSrc !== "/fallback-logo.png") {
          setErrorCount(1);
          setImgSrc(`${IMG_PROXY}${encodeURIComponent(originalSrc)}`);
        } else {
          setImgSrc("/fallback-logo.png");
        }
      }}
      {...imageProps}
    />
  );
});
SmartImage.displayName = 'SmartImage';

const MatchCountdown = memo(({ startTimeStr, status }: { startTimeStr: string, status: string }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startTime = startTimeStr ? new Date(startTimeStr) : null;

  if (status === 'recent') {
    return <div className="text-gray-400 text-xs font-bold uppercase mt-2">Match Ended</div>;
  }

  if (status === 'live') {
    const elapsedStr = startTime ? (() => {
      const elapsedMs = time.getTime() - startTime.getTime();
      const elapsedSecs = Math.max(0, Math.floor(elapsedMs / 1000));
      const h = Math.floor(elapsedSecs / 3600);
      const m = Math.floor((elapsedSecs % 3600) / 60);
      const s = elapsedSecs % 60;
      return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    })() : "00:00";

    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg md:text-xl animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">((•))</span>
        <span className="text-red-500 text-[10px] md:text-xs font-bold tracking-wide uppercase">Live</span>
        <span className="text-[#00E5FF] text-[10px] md:text-xs font-mono font-bold bg-[#00E5FF]/10 px-2 py-0.5 rounded shadow-inner tracking-widest">{elapsedStr}</span>
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
      <div className="text-gray-200 text-sm md:text-base font-bold tracking-wide">{timeStr}</div>
      <div className="text-[#00E5FF] text-[10px] md:text-xs font-bold mt-0.5">{dateStr}</div>
      
      {diffHours < 1 ? (
        <div className="text-amber-400 text-[11px] md:text-xs mt-2 font-bold whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse font-mono tracking-wider">
           In {diffMins.toString().padStart(2, '0')}m {diffSecs.toString().padStart(2, '0')}s
        </div>
      ) : (
        <div className="text-gray-300 text-[10px] md:text-xs mt-2 font-semibold">
           Starting in {diffHours}h {diffMins}m
        </div>
      )}
    </div>
  );
});
MatchCountdown.displayName = 'MatchCountdown';

const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || match.event || {};
  const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} className="h-full">
      <Link href={`/watch/${slugLink}`} className="outline-none block h-full mb-3 md:mb-0" prefetch={false}>
        <div className="bg-[#1C1E2B] border border-[#2A8496]/70 rounded-[16px] p-4 transition-all hover:border-[#00E5FF] hover:shadow-[0_4px_20px_rgba(0,229,255,0.15)] h-full flex flex-col justify-between">
          
          {(eventInfo.eventCat || eventInfo.eventName) && (
            <div className="flex items-center justify-center gap-2 mb-4 border-b border-gray-800/60 pb-3">
              {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
                <div className="relative w-5 h-5 bg-white rounded-full overflow-hidden flex-shrink-0">
                  <SmartImage src={eventInfo.eventLogo} alt="Logo" fill className="object-contain p-0.5" />
                </div>
              )}
              <span className="text-xs md:text-sm text-gray-300 font-semibold truncate max-w-[85%] uppercase tracking-wide">
                {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' | ')}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center px-1 md:px-3 mt-auto">
            <div className="flex flex-col items-center gap-1.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full bg-white overflow-hidden border-2 border-gray-400/50 shadow-sm">
                <SmartImage src={eventInfo.teamAFlag} alt={eventInfo.teamA || 'Team A'} fill className="object-cover" />
              </div>
              <span className="font-bold text-[11px] md:text-sm text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamA || 'Team A'}</span>
            </div>

            <div className="w-[40%] flex flex-col justify-center items-center">
              <MatchCountdown startTimeStr={eventInfo.startTime} status={status} />
            </div>

            <div className="flex flex-col items-center gap-1.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full bg-white overflow-hidden border-2 border-gray-400/50 shadow-sm">
                <SmartImage src={eventInfo.teamBFlag} alt={eventInfo.teamB || 'Team B'} fill className="object-cover" />
              </div>
              <span className="font-bold text-[11px] md:text-sm text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamB || 'Team B'}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}, (prevProps, nextProps) => prevProps.match.id === nextProps.match.id && prevProps.status === nextProps.status);
MatchCard.displayName = 'MatchCard';

export default function MatchListBottom({ currentMatchId }: { currentMatchId: string }) {
  const { data: rawMatches, error } = useSWR(LIVE_EVENTS_API, fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: false,
  });

  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!rawMatches || !Array.isArray(rawMatches)) return;

    const now = Date.now();
    const liveList: any[] = [];
    const upcomingList: any[] = [];

    rawMatches.forEach((item: any, index: number) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : index.toString();
      
      if (matchId === currentMatchId) return;

      const convertDate = (dStr: string, tStr: string) => {
  if (!dStr || !tStr) return "";
  try {
    const parts = dStr.split('/');
    let day = 1, month = 1, year = 2026;
    if (parts.length === 3) {
      day = parseInt(parts[0], 10); 
      month = parseInt(parts[1], 10); 
      year = parseInt(parts[2], 10);
    } else if (dStr.includes('-')) {
      const hyphenParts = dStr.split('-');
      if (hyphenParts[0].length === 4) {
        year = parseInt(hyphenParts[0], 10); month = parseInt(hyphenParts[1], 10); day = parseInt(hyphenParts[2], 10);
      } else {
        day = parseInt(hyphenParts[0], 10); month = parseInt(hyphenParts[1], 10); year = parseInt(hyphenParts[2], 10);
      }
    }
    
    const timeParts = tStr.split(':');
    let hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;
    
    // 💡 এপিআই যদি ২৪ ঘণ্টার ফরম্যাট না মেনে রাত ১১ টাকে ২৩ না লিখে সরাসরি ১১ লেখে, 
    // তবে নিচের কমেন্ট করা লাইনটি আনকমেন্ট করে দিতে পারেন:
    // if (hours < 12 && tStr.toLowerCase().includes('pm')) hours += 12;

    // 🎯 জাদুকরী ফিক্স: সরাসরি Date.UTC দিয়ে বাংলাদেশ সময়কে (UTC+6) স্ট্যান্ডার্ড ISO তে রূপান্তর
    // যেহেতু বাংলাদেশ ৬ ঘণ্টা এগিয়ে, তাই UTC সময় পেতে আমরা ঘন্টা থেকে ঠিক ৬ বিয়োগ করে জেনারেট করছি।
    // এটি ব্রাউজার বা সার্ভার যেখানেই রান হোক না কেন, সবসময় নিখুঁত বাংলাদেশ টাইম দেখাবে।
    const utcTimestamp = Date.UTC(year, month - 1, day, hours - 6, minutes, 0);
    return new Date(utcTimestamp).toISOString();
  } catch (e) { return ""; }
};


      const startTime = convertDate(rawEvent.date, rawEvent.time);
      const endTime = convertDate(rawEvent.end_date || rawEvent.date, rawEvent.end_time || rawEvent.time);

      const matchObj = {
        id: matchId,
        eventInfo: {
          eventCat: rawEvent.category || "Live Event",
          eventName: rawEvent.eventName || "Live Match",
          teamA: rawEvent.teamAName || "Team A",
          teamB: rawEvent.teamBName || "Team B",
          teamAFlag: rawEvent.teamAFlag || "",
          teamBFlag: rawEvent.teamBFlag || "",
          startTime,
          endTime,
          eventLogo: rawEvent.eventLogo || ""
        }
      };

      const startMs = startTime ? new Date(startTime).getTime() : null;
      if (startMs && now >= startMs - 15 * 60 * 1000) {
        liveList.push(matchObj);
      } else {
        upcomingList.push(matchObj);
      }
    });

    setLiveMatches(liveList);
    setUpcomingMatches(upcomingList);
  }, [rawMatches, currentMatchId]);

  if (error) return null;
  if (!rawMatches || (liveMatches.length === 0 && upcomingMatches.length === 0)) return null;

  return (
    <div className="w-full mt-8 border-t border-gray-800/60 pt-6">
      {liveMatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <h2 className="text-base md:text-lg font-bold text-white tracking-wide uppercase">More Live Matches</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} status="live" />
            ))}
          </div>
        </div>
      )}

      {upcomingMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF]"></span>
            <h2 className="text-base md:text-lg font-bold text-white tracking-wide uppercase">Upcoming Matches</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} status="upcoming" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
