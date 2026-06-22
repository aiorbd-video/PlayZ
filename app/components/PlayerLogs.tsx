'use client';

import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import useSWR from 'swr';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

interface PlayerLogsProps {
  matchTitle?: string;
  matchObj?: any;
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const generateSlug = (teamA: string, teamB: string, eventName: string, id: string | number) => {
  const baseName = `${teamA || ''} vs ${teamB || ''} ${eventName || ''}`.trim();
  const cleanName = baseName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  return `${cleanName}-${id}`;
};

// 🎯 রিয়েল-টাইম টাইম এবং কাউন্টডাউন কম্পোনেন্ট
const MatchTimeDisplay = ({ startTimeStr }: { startTimeStr: string }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startTimeStr) return <span className="text-gray-400 text-xs font-bold">TBA</span>;

  // তারিখ পার্সিং (ক্রস-ব্রাউজার সাপোর্ট)
  const startTime = new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  
  if (isNaN(startTime.getTime())) return <span className="text-gray-400 text-xs font-bold">TBA</span>;

  const diffMs = startTime.getTime() - now.getTime();
  const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let statusStr = '';
  if (diffMs <= 0) {
    statusStr = 'Match Started / Live';
  } else {
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffDays > 0) {
      statusStr = `Starts in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      statusStr = `Match Starting in ${diffHours} Hour${diffHours > 1 ? 's' : ''}`;
    } else {
      statusStr = `Starts in ${diffMins} min${diffMins > 1 ? 's' : ''}`;
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 w-full">
      <span className="text-gray-200 text-xs md:text-sm font-bold tracking-wide">{timeStr}</span>
      <span className="text-emerald-400 text-[10px] md:text-xs font-semibold">{dateStr}</span>
      <span className="text-gray-400 text-[10px] md:text-xs font-medium">{statusStr}</span>
    </div>
  );
};

export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchObj }, ref) => {
  
  useImperativeHandle(ref, () => ({
    addLog: () => {},
    clearLogs: () => {},
  }));

  const { data: rawMatches } = useSWR('https://ratulxadia-playz-cats-event.hf.space/api/events', fetcher, { revalidateOnFocus: false });

  const otherMatches = (rawMatches || [])
    .map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace('pro/', '').replace('.txt', '') : index.toString();
      return {
        id: matchId,
        eventInfo: {
          eventName: rawEvent.eventName || '',
          eventCat: rawEvent.category || '',
          eventLogo: rawEvent.eventLogo && rawEvent.eventLogo !== 'null' ? rawEvent.eventLogo : null,
          teamA: rawEvent.teamAName || 'Team A',
          teamB: rawEvent.teamBName || 'Team B',
          teamAFlag: rawEvent.teamAFlag && rawEvent.teamAFlag !== 'null' ? rawEvent.teamAFlag : '/fallback-logo.png',
          teamBFlag: rawEvent.teamBFlag && rawEvent.teamBFlag !== 'null' ? rawEvent.teamBFlag : '/fallback-logo.png',
          startTime: rawEvent.startTime || '',
        }
      };
    })
    .filter((m: any) => String(m.id) !== String(matchObj?.id))
    .slice(0, 10);

  if (!otherMatches || otherMatches.length === 0) return null;

  return (
    <div className="mt-8 mb-4 w-full">
      {/* 🎯 টাইটেল */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-800/60 pb-2">
        <span className="text-rose-500 animate-pulse text-lg drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">((•))</span>
        <h2 className="text-sm md:text-base font-black text-white uppercase tracking-widest">
          More Live Events
        </h2>
      </div>
      
      {/* 🎯 ডিটেইলড ম্যাচ কার্ডস (Vertical List) */}
      <div className="flex flex-col gap-3 md:gap-4">
        {otherMatches.map((match: any) => {
          const slug = generateSlug(match.eventInfo.teamA, match.eventInfo.teamB, match.eventInfo.eventName, match.id);
          const headerTitle = [match.eventInfo.eventCat, match.eventInfo.eventName].filter(Boolean).join(' | ');
          
          return (
            <a key={match.id} href={`/watch/${slug}`} className="block outline-none group">
              <div className="bg-[#1C1E2B] border border-[#2A8496]/50 rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:border-[#00E5FF]/80 hover:shadow-[0_4px_15px_rgba(0,229,255,0.15)] hover:-translate-y-0.5">
                
                {/* কার্ড হেডার (Event Category & Name) */}
                {(headerTitle || match.eventInfo.eventLogo) && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800/60 bg-gray-900/30">
                    {match.eventInfo.eventLogo && (
                      <img src={match.eventInfo.eventLogo} alt="Logo" className="w-4 h-4 object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                    )}
                    <span className="text-[10px] md:text-xs text-gray-300 font-semibold truncate max-w-[90%] uppercase tracking-wide">
                      {headerTitle || 'Live Event'}
                    </span>
                  </div>
                )}

                {/* কার্ড বডি (Teams & Time) */}
                <div className="flex justify-between items-center p-3 md:p-4">
                  
                  {/* Team A */}
                  <div className="flex flex-col items-center gap-1.5 w-[30%]">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-white overflow-hidden border border-gray-500/50 shadow-sm">
                      <img src={match.eventInfo.teamAFlag} alt={match.eventInfo.teamA} className="w-full h-full object-cover" onError={(e) => e.currentTarget.src='/fallback-logo.png'} />
                    </div>
                    <span className="font-bold text-[10px] md:text-xs text-gray-200 truncate w-full text-center mt-1 group-hover:text-white">
                      {match.eventInfo.teamA}
                    </span>
                  </div>

                  {/* Center: Time & Countdown */}
                  <div className="w-[40%] flex justify-center">
                    <MatchTimeDisplay startTimeStr={match.eventInfo.startTime} />
                  </div>

                  {/* Team B */}
                  <div className="flex flex-col items-center gap-1.5 w-[30%]">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-white overflow-hidden border border-gray-500/50 shadow-sm">
                      <img src={match.eventInfo.teamBFlag} alt={match.eventInfo.teamB} className="w-full h-full object-cover" onError={(e) => e.currentTarget.src='/fallback-logo.png'} />
                    </div>
                    <span className="font-bold text-[10px] md:text-xs text-gray-200 truncate w-full text-center mt-1 group-hover:text-white">
                      {match.eventInfo.teamB}
                    </span>
                  </div>

                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
