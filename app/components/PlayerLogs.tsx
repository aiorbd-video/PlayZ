'use client';

import { forwardRef, useImperativeHandle, useState, useEffect, memo } from 'react';
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

// 🎯 আপনার দেওয়া অরিজিনাল MatchCountdown কম্পোনেন্ট (হুবহু বসানো হয়েছে)
export const MatchCountdown = memo(({ startTimeStr, endTimeStr, status }: { startTimeStr: string, endTimeStr: string, status: string }) => {
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

export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchObj }, ref) => {
  
  useImperativeHandle(ref, () => ({
    addLog: () => {},
    clearLogs: () => {},
  }));

  const { data: rawMatches } = useSWR('https://ratulxadia-playz-cats-event.hf.space/api/events', fetcher, { revalidateOnFocus: false });

  // 🎯 হোমপেইজের মতো নিখুঁত অবজেক্ট ম্যাপিং লেয়ার
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
      {/* মোর লাইভ ইভেন্টস হেডার */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-800/60 pb-2">
        <span className="text-rose-500 animate-pulse text-lg drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">((•))</span>
        <h2 className="text-sm md:text-base font-black text-white uppercase tracking-widest">
          More Live Events
        </h2>
      </div>
      
      {/* ভার্টিক্যাল ম্যাচ কার্ড লিস্ট */}
      <div className="flex flex-col gap-3 md:gap-4">
        {otherMatches.map((match: any) => {
          const slug = generateSlug(match.eventInfo.teamA, match.eventInfo.teamB, match.eventInfo.eventName, match.id);
          const headerTitle = [match.eventInfo.eventCat, match.eventInfo.eventName].filter(Boolean).join(' | ');
          
          return (
            <a key={match.id} href={`/watch/${slug}`} className="block outline-none group">
              <div className="bg-[#1C1E2B] border border-[#2A8496]/50 rounded-xl overflow-hidden flex flex-col transition-all duration-300 hover:border-[#00E5FF]/80 hover:shadow-[0_4px_15px_rgba(0,229,255,0.15)] hover:-translate-y-0.5">
                
                {/* কার্ডের উপরের হেডার ক্যাটাগরি */}
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

                {/* কার্ডের বডি (টিম ফ্ল্যাগ ও আপনার দেওয়া অরজিনাল কাউন্টডাউন) */}
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

                  {/* Center Component (হুবহু হোমপেইজের মতো কাউন্টডাউন রান করবে) */}
                  <div className="w-[40%] flex justify-center">
                    <MatchCountdown startTimeStr={match.eventInfo.startTime} endTimeStr={match.eventInfo.endTime} status={match.status} />
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
