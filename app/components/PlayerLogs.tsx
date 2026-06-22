'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, memo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { motion } from 'framer-motion';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

interface PlayerLogsProps {
  matchTitle?: string;
  matchObj?: any;
}

// 🎯 Helpers
const IMG_PROXY = "https://wsrv.nl/?url=";
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const generateSlug = (teamA: string, teamB: string, eventName: string, id: string | number) => {
  const baseName = `${teamA || ''} vs ${teamB || ''} ${eventName || ''}`.trim();
  const cleanName = baseName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  return `${cleanName}-${id}`;
};

// 🎯 আপনার দেওয়া অরজিনাল SmartImage
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

// 🎯 আপনার দেওয়া অরজিনাল MatchCountdown
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

  if (status === 'live' && startTime) {
    const elapsedMs = time.getTime() - startTime.getTime();
    const elapsedSecs = Math.max(0, Math.floor(elapsedMs / 1000));
    const h = Math.floor(elapsedSecs / 3600);
    const m = Math.floor((elapsedSecs % 3600) / 60);
    const s = elapsedSecs % 60;
    const elapsedStr = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg md:text-xl animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">((•))</span>
        <span className="text-red-500 text-[10px] md:text-xs font-bold tracking-wide uppercase">Live</span>
        <span className="text-[#00E5FF] text-[10px] md:text-xs font-mono font-bold bg-[#00E5FF]/10 px-2 py-0.5 rounded shadow-inner tracking-widest">{elapsedStr}</span>
      </div>
    );
  } else if (status === 'live') {
    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg md:text-xl animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">((•))</span>
        <span className="text-red-500 text-[10px] md:text-xs font-bold tracking-wide uppercase">Live</span>
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

// 🎯 আপনার দেওয়া অরজিনাল MatchCard
const MatchCardComponent = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || match.event || {};
  const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} className="h-full">
      <a href={`/watch/${slugLink}`} className="outline-none block h-full mb-3 md:mb-0">
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
              <MatchCountdown startTimeStr={eventInfo.startTime} endTimeStr={eventInfo.endTime} status={status} />
            </div>

            <div className="flex flex-col items-center gap-1.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full bg-white overflow-hidden border-2 border-gray-400/50 shadow-sm">
                <SmartImage src={eventInfo.teamBFlag} alt={eventInfo.teamB || 'Team B'} fill className="object-cover" />
              </div>
              <span className="font-bold text-[11px] md:text-sm text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamB || 'Team B'}</span>
            </div>
          </div>
        </div>
      </a>
    </motion.div>
  );
}, (prevProps, nextProps) => prevProps.match.id === nextProps.match.id && prevProps.status === nextProps.status);
MatchCardComponent.displayName = 'MatchCardComponent';

// 🎯 Main PlayerLogs Component
export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchObj }, ref) => {
  
  useImperativeHandle(ref, () => ({
    addLog: () => {},
    clearLogs: () => {},
  }));

  const { data: rawMatches } = useSWR('https://ratulxadia-playz-cats-event.hf.space/api/events', fetcher, { revalidateOnFocus: false });

  // রানিং ম্যাচটা বাদ দিয়ে বাকিগুলো ফিল্টার করা হচ্ছে
  const otherMatches = (rawMatches || [])
    .map((item: any, index: number) => {
      const eventInfo = item.eventInfo || item.event || {};
      const matchId = eventInfo.links ? eventInfo.links.replace('pro/', '').replace('.txt', '') : index.toString();
      
      return {
        id: matchId,
        status: item.status || eventInfo.status || '',
        eventInfo: {
          eventName: eventInfo.eventName || '',
          eventCat: eventInfo.eventCat || eventInfo.category || '',
          eventLogo: eventInfo.eventLogo && eventInfo.eventLogo !== 'null' ? eventInfo.eventLogo : null,
          teamA: eventInfo.teamA || eventInfo.teamAName || 'Team A',
          teamB: eventInfo.teamB || eventInfo.teamBName || 'Team B',
          teamAFlag: eventInfo.teamAFlag && eventInfo.teamAFlag !== 'null' ? eventInfo.teamAFlag : '/fallback-logo.png',
          teamBFlag: eventInfo.teamBFlag && eventInfo.teamBFlag !== 'null' ? eventInfo.teamBFlag : '/fallback-logo.png',
          startTime: eventInfo.startTime || '',
          endTime: eventInfo.endTime || ''
        }
      };
    })
    .filter((m: any) => String(m.id) !== String(matchObj?.id))
    .slice(0, 10);

  if (!otherMatches || otherMatches.length === 0) return null;

  return (
    <div className="mt-8 mb-4 w-full">
      <div className="flex items-center gap-2 mb-4 border-b border-gray-800/60 pb-2">
        <span className="text-rose-500 animate-pulse text-lg drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">((•))</span>
        <h2 className="text-sm md:text-base font-black text-white uppercase tracking-widest">
          More Live Events
        </h2>
      </div>
      
      {/* 🎯 আপনার অরজিনাল MatchCardComponent দিয়ে গ্রিড রেন্ডার করা হলো */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherMatches.map((match: any) => (
          <MatchCardComponent key={match.id} match={match} status={match.status} />
        ))}
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
