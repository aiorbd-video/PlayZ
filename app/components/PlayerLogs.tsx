'use client';

import { forwardRef, useImperativeHandle } from 'react';
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

// স্লাগ জেনারেটর (রাউটিং এর জন্য)
const generateSlug = (teamA: string, teamB: string, eventName: string, id: string | number) => {
  const baseName = `${teamA || ''} vs ${teamB || ''} ${eventName || ''}`.trim();
  const cleanName = baseName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  return `${cleanName}-${id}`;
};

export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchObj }, ref) => {
  
  // 🎯 প্লেয়ার যাতে ক্র্যাশ না করে তাই addLog কে সাইলেন্ট করে রাখা হয়েছে (No UI)
  useImperativeHandle(ref, () => ({
    addLog: () => {},
    clearLogs: () => {},
  }));

  // লাইভ ইভেন্টগুলো ফেচ করা হচ্ছে
  const { data: rawMatches } = useSWR('https://ratulxadia-playz-cats-event.hf.space/api/events', fetcher, { revalidateOnFocus: false });

  // ডাটা প্রোসেস এবং বর্তমান ম্যাচটা ফিল্টার করে বাদ দেওয়া
  const otherMatches = (rawMatches || [])
    .map((item: any, index: number) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace('pro/', '').replace('.txt', '') : index.toString();
      return {
        id: matchId,
        eventInfo: {
          eventName: rawEvent.eventName || 'Live Match',
          teamA: rawEvent.teamAName || 'Team A',
          teamB: rawEvent.teamBName || 'Team B',
          teamAFlag: rawEvent.teamAFlag && rawEvent.teamAFlag !== 'null' ? rawEvent.teamAFlag : '/fallback-logo.png',
          teamBFlag: rawEvent.teamBFlag && rawEvent.teamBFlag !== 'null' ? rawEvent.teamBFlag : '/fallback-logo.png',
        }
      };
    })
    .filter((m: any) => String(m.id) !== String(matchObj?.id)) // রানিং ম্যাচটা লিস্ট থেকে বাদ
    .slice(0, 8); // সর্বোচ্চ ৮টি ম্যাচ দেখাবে

  if (!otherMatches || otherMatches.length === 0) return null;

  return (
    <div className="mt-8 mb-4 w-full">
      {/* টাইটেল সেকশন */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-800/60 pb-2">
        <span className="text-rose-500 animate-pulse text-lg drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">((•))</span>
        <h2 className="text-sm md:text-base font-black text-white uppercase tracking-widest">
          More Live Events
        </h2>
      </div>
      
      {/* ম্যাচ গ্রিড কার্ডস */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {otherMatches.map((match: any) => {
          const slug = generateSlug(match.eventInfo.teamA, match.eventInfo.teamB, match.eventInfo.eventName, match.id);
          
          return (
            <a key={match.id} href={`/watch/${slug}`} className="block outline-none group">
              <div className="bg-[#1C1E2B] border border-gray-800/80 rounded-xl p-3 md:p-4 flex items-center justify-between transition-all duration-300 hover:border-[#00E5FF]/50 hover:shadow-[0_4px_15px_rgba(0,229,255,0.1)] hover:-translate-y-1">
                
                {/* Team A */}
                <div className="flex items-center gap-2 md:gap-3 w-[42%]">
                  <img 
                    src={match.eventInfo.teamAFlag} 
                    alt={match.eventInfo.teamA} 
                    className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-full border border-gray-700 bg-white p-0.5" 
                    onError={(e) => e.currentTarget.src='/fallback-logo.png'} 
                  />
                  <span className="text-[11px] md:text-xs font-bold text-gray-300 truncate group-hover:text-white">
                    {match.eventInfo.teamA}
                  </span>
                </div>
                
                {/* VS Badge */}
                <div className="text-[9px] md:text-[10px] font-black text-gray-500 bg-gray-900 px-2 py-1 rounded shadow-inner">
                  VS
                </div>
                
                {/* Team B */}
                <div className="flex items-center gap-2 md:gap-3 w-[42%] justify-end text-right">
                  <span className="text-[11px] md:text-xs font-bold text-gray-300 truncate group-hover:text-white">
                    {match.eventInfo.teamB}
                  </span>
                  <img 
                    src={match.eventInfo.teamBFlag} 
                    alt={match.eventInfo.teamB} 
                    className="w-8 h-8 md:w-10 md:h-10 object-cover rounded-full border border-gray-700 bg-white p-0.5" 
                    onError={(e) => e.currentTarget.src='/fallback-logo.png'} 
                  />
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
