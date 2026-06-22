'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

interface PlayerLogsProps {
  matchTitle?: string;
  matchObj?: any; // 🎯 ফুল ম্যাচ ডাটা (লোগো, টিম নেম) নেওয়ার জন্য
}

export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchTitle, matchObj }, ref) => {
  const [statusText, setStatusText] = useState('Engine Initializing...');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warn'>('info');
  const [shareText, setShareText] = useState('Share Match');

  useImperativeHandle(ref, () => ({
    addLog: (message: string, type = 'info') => {
      if (message.includes('live on-screen')) {
        setStatusText('Live Broadcast Active');
        setStatusType('success');
      } else if (message.includes('Switching server') || type === 'error') {
        setStatusText('Network Glitch! Auto-switching...');
        setStatusType('error');
      } else if (message.includes('Loading Source')) {
        setStatusText('Buffering Stream...');
        setStatusType('info');
      } else if (message.includes('Autoplay deferred')) {
        setStatusText('Click Play to Start');
        setStatusType('warn');
      }
    },
    clearLogs: () => {
      setStatusText('Engine Ready');
      setStatusType('info');
    },
  }));

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      const shareData = {
        title: matchTitle || 'Live Stream',
        text: `🔥 Watch live match: ${matchTitle || ''}`,
        url: window.location.href,
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          setShareText('Shared! 🎉');
          setTimeout(() => setShareText('Share Match'), 2000);
        } catch (err) {}
      } else {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setShareText('Copied! 🚀');
          setTimeout(() => setShareText('Share Match'), 2000);
        } catch (clipErr) {
          setShareText('Share Failed');
        }
      }
    }
  };

  // 🎯 ম্যাচ ডাটা থেকে লোগো এবং নাম আলাদা করা
  const eventInfo = matchObj?.eventInfo || matchObj?.event || {};
  const teamA = eventInfo.teamA || matchTitle?.split(' VS ')[0] || 'Team A';
  const teamB = eventInfo.teamB || matchTitle?.split(' VS ')[1] || 'Team B';
  const teamAFlag = eventInfo.teamAFlag && eventInfo.teamAFlag !== 'null' ? eventInfo.teamAFlag : '/fallback-logo.png';
  const teamBFlag = eventInfo.teamBFlag && eventInfo.teamBFlag !== 'null' ? eventInfo.teamBFlag : '/fallback-logo.png';
  const eventName = eventInfo.eventName || eventInfo.eventCat || '';

  return (
    <div className="mt-6 w-full bg-[#1C1E2B] border border-[#2A8496]/50 hover:border-[#00E5FF]/80 rounded-[16px] p-4 sm:p-6 shadow-2xl transition-all duration-300">
      
      {/* Top Bar: Event Name & Share */}
      <div className="flex justify-between items-center border-b border-gray-800/60 pb-3 mb-5">
        <span className="text-xs md:text-sm text-[#00E5FF] font-black uppercase tracking-widest truncate max-w-[70%]">
          {eventName || 'Live Stream Event'}
        </span>
        <button
          onClick={handleShare}
          className="px-3 py-1.5 bg-gray-900/50 hover:bg-[#00E5FF]/10 active:scale-95 text-[10px] sm:text-xs font-bold rounded-lg border border-gray-700/50 hover:border-[#00E5FF]/50 text-gray-300 hover:text-[#00E5FF] flex items-center gap-1.5 transition-all outline-none"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          {shareText}
        </button>
      </div>

      {/* Center: Match Card Layout (Team A vs Team B) */}
      <div className="flex justify-between items-center">
        
        {/* Team A */}
        <div className="flex flex-col items-center gap-2 w-[30%]">
          <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-500/50 shadow-md">
            <img src={teamAFlag} alt={teamA} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '/fallback-logo.png')} />
          </div>
          <span className="font-bold text-[11px] sm:text-sm md:text-base text-white text-center line-clamp-2 leading-tight">
            {teamA}
          </span>
        </div>

        {/* VS & Status Indicator */}
        <div className="flex flex-col items-center justify-center w-[40%] gap-1">
          <span className="text-rose-500 text-xl sm:text-3xl animate-pulse drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]">((•))</span>
          <span className="text-gray-400 font-black text-xs sm:text-sm uppercase tracking-widest">VS</span>
          
          {/* Dynamic Engine Status */}
          <div className={`mt-2 px-2.5 py-1 rounded border text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-center ${
            statusType === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            statusType === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
            statusType === 'warn' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
            'bg-[#00E5FF]/10 border-[#00E5FF]/20 text-[#00E5FF]'
          }`}>
            {statusText}
          </div>
        </div>

        {/* Team B */}
        <div className="flex flex-col items-center gap-2 w-[30%]">
          <div className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-gray-500/50 shadow-md">
            <img src={teamBFlag} alt={teamB} className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = '/fallback-logo.png')} />
          </div>
          <span className="font-bold text-[11px] sm:text-sm md:text-base text-white text-center line-clamp-2 leading-tight">
            {teamB}
          </span>
        </div>

      </div>

    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
