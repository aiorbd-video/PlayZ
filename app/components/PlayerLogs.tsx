'use client';

import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

interface PlayerLogsProps {
  matchTitle?: string;
}

export const PlayerLogs = forwardRef<PlayerLogsHandle, PlayerLogsProps>(({ matchTitle }, ref) => {
  const [statusText, setStatusText] = useState('ইঞ্জিন প্রস্তুত। লাইভ সিঙ্ক হচ্ছে...');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warn'>('info');
  const [shareText, setShareText] = useState('Share Stream');

  // ব্যাকগ্রাউন্ডে Shaka Engine থেকে আসা ডাটা রিড করে স্ট্যাটাস আপডেট করা
  useImperativeHandle(ref, () => ({
    addLog: (message: string, type = 'info') => {
      if (message.includes('live on-screen')) {
        setStatusText('সরাসরি সম্প্রচার সচল আছে (Ultra HD)');
        setStatusType('success');
      } else if (message.includes('Switching server') || type === 'error') {
        setStatusText('নেটওয়ার্ক ড্রপ! বিকল্প লাইনে অটো-শিফট হচ্ছে...');
        setStatusType('error');
      } else if (message.includes('Loading Source')) {
        setStatusText('লাইভ ফিড বাফারিং ও অপ্টিমাইজ করা হচ্ছে...');
        setStatusType('info');
      } else if (message.includes('Autoplay deferred')) {
        setStatusText('ব্রাউজার পলিসি! খেলা সচল করতে স্ক্রিনে ক্লিক করুন');
        setStatusType('warn');
      }
    },
    clearLogs: () => {
      setStatusText('ইঞ্জিন প্রস্তুত');
      setStatusType('info');
    },
  }));

  // ওয়ান-ক্লিক শেয়ার লজিক (ক্লিপবোর্ড কপি)
  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setShareText('Link Copied! 🚀');
      setTimeout(() => setShareText('Share Stream'), 2000);
    }
  };

  return (
    <div className="mt-6 w-full bg-gradient-to-br from-[#1A1D2E] to-[#131522] rounded-2xl border border-gray-800/60 p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5 transition-all duration-300">
      
      {/* বাম পাশ: ম্যাচ ডিটেইলস এবং লাইভ ইন্ডিকেটর */}
      <div className="flex items-center gap-4 w-full sm:w-auto">
        {/* টিভি-রেডি বড় ব্লিংকিং লাইভ ডট */}
        <div className="relative flex h-4 w-4 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            statusType === 'success' ? 'bg-emerald-400' : statusType === 'error' ? 'bg-rose-400' : 'bg-cyan-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-4 w-4 ${
            statusType === 'success' ? 'bg-emerald-500' : statusType === 'error' ? 'bg-rose-500' : 'bg-cyan-500'
          }`}></span>
        </div>

        {/* ম্যাচ টাইটেল ও সাবস্ট্যাটাস */}
        <div className="flex flex-col truncate">
          <span className="text-[11px] font-black tracking-widest text-[#00E5FF] uppercase">
            {statusText}
          </span>
          <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[280px] sm:max-w-[400px] md:max-w-[500px] mt-0.5 tracking-wide">
            {matchTitle || 'Live Stream Broadcast'}
          </h2>
        </div>
      </div>

      {/* ডান পাশ: অ্যাকশন বাটন (শেয়ার) */}
      <div className="w-full sm:w-auto flex justify-end shrink-0 border-t border-gray-800/40 sm:border-none pt-4 sm:pt-0">
        <button
          onClick={handleShare}
          className="w-full sm:w-auto px-5 py-2.5 bg-[#1C1E2D] hover:bg-[#25283C] active:scale-95 text-xs font-black rounded-xl border border-gray-700/50 text-gray-200 flex items-center justify-center gap-2 transition-all cursor-pointer outline-none shadow-md hover:text-[#00E5FF] hover:border-[#00E5FF]/40 group"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          {shareText}
        </button>
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
