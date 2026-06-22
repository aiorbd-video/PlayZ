'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

interface PlayerLogsProps {
  matchTitle?: string;
}

export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchTitle }, ref) => {
  const [statusText, setStatusText] = useState('Engine Initializing...');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warn'>('info');
  const [shareText, setShareText] = useState('Share Match');

  useImperativeHandle(ref, () => ({
    addLog: (message: string, type = 'info') => {
      if (message.includes('live on-screen')) {
        setStatusText('Live Broadcast Active (Ultra HD)');
        setStatusType('success');
      } else if (message.includes('Switching server') || type === 'error') {
        setStatusText('Network Glitch! Auto-switching stream...');
        setStatusType('error');
      } else if (message.includes('Loading Source')) {
        setStatusText('Buffering & Optimizing Stream...');
        setStatusType('info');
      } else if (message.includes('Autoplay deferred')) {
        setStatusText('Click the Play button to start');
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
        title: matchTitle || 'Reborn Live Stream',
        text: `🔥 Watch live match on Reborn Stream: ${matchTitle || ''}`,
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
          setShareText('Link Copied! 🚀');
          setTimeout(() => setShareText('Share Match'), 2000);
        } catch (clipErr) {
          setShareText('Share Failed');
        }
      }
    }
  };

  return (
    <div className="mt-6 w-full bg-gradient-to-br from-[#121421] to-[#0d0f19] rounded-3xl border border-gray-800 p-6 shadow-2xl transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Branding & Status */}
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800 shrink-0 shadow-inner">
            <span className="text-[10px] font-black text-[#00E5FF] tracking-widest uppercase">Reborn</span>
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <span className={`relative flex h-2.5 w-2.5`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusType === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusType === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusType === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                {statusText}
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-white leading-tight">
              {matchTitle || 'Live Streaming'}
            </h2>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleShare}
          className="px-6 py-3 bg-[#1C1F30] hover:bg-[#25283C] active:scale-95 text-xs font-black rounded-xl border border-gray-700/50 text-white flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg hover:border-[#00E5FF]/40 hover:text-[#00E5FF]"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          {shareText}
        </button>
      </div>
      
      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-gray-800/50 flex justify-between items-center text-[10px] text-gray-500 font-bold uppercase tracking-wider">
        <span>Powered by Reborn Engine</span>
        <span>Version 1.0.0</span>
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
