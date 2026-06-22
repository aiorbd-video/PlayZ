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
  const [statusText, setStatusText] = useState('ইঞ্জিন প্রস্তুত। লাইভ সিঙ্ক হচ্ছে...');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warn'>('info');
  const [shareText, setShareText] = useState('Share Stream');

  // ব্যাকগ্রাউন্ড ট্র্যাকিং (কোড ব্রেকিং প্রটেকশন)
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

  // 🎯 নেটিভ ডিজিটাল সোশ্যাল শেয়ার ইঞ্জিন (WhatsApp, Messenger, OS Share ready)
  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      const shareData = {
        title: matchTitle || 'Live Stream Broadcast',
        text: `🔥 PlayZ লাইভ স্ট্রিমিংয়ে সরাসরি খেলা চলছে! জলদি জয়েন করো: ${matchTitle || ''}\n`,
        url: window.location.href,
      };

      // চেক করা হচ্ছে ব্রাউজার আধুনিক Web Share API সাপোর্ট করে কিনা
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          setShareText('Shared! 🎉');
          setTimeout(() => setShareText('Share Stream'), 2000);
        } catch (err) {
          // ইউজার শেয়ার ক্যানসেল করলে কোনো এরর দেখাবে না
        }
      } else {
        // 🛠️ স্মার্ট টিভি বা ওল্ড ব্রাউজারের জন্য ব্যাকআপ ফলব্যাক (লিংক কপি)
        try {
          await navigator.clipboard.writeText(window.location.href);
          setShareText('Link Copied! 🚀');
          setTimeout(() => setShareText('Share Stream'), 2000);
        } catch (clipErr) {
          setShareText('Share Failed');
        }
      }
    }
  };

  return (
    <div className="mt-6 w-full bg-gradient-to-br from-[#1A1D2E] to-[#131522] rounded-2xl border border-gray-800/60 p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-5 transition-all duration-300">
      
      {/* বাম পাশ: লাইভ স্ট্যাটাস ও ম্যাচ ইন্ডিকেটর */}
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="relative flex h-4 w-4 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
            statusType === 'success' ? 'bg-emerald-400' : statusType === 'error' ? 'bg-rose-400' : 'bg-cyan-400'
          }`}></span>
          <span className={`relative inline-flex rounded-full h-4 w-4 ${
            statusType === 'success' ? 'bg-emerald-500' : statusType === 'error' ? 'bg-rose-500' : 'bg-cyan-500'
          }`}></span>
        </div>

        <div className="flex flex-col truncate">
          <span className="text-[11px] font-black tracking-widest text-[#00E5FF] uppercase">
            {statusText}
          </span>
          <h2 className="text-base sm:text-lg font-black text-white truncate max-w-[280px] sm:max-w-[400px] md:max-w-[500px] mt-0.5 tracking-wide">
            {matchTitle || 'Live Stream Broadcast'}
          </h2>
        </div>
      </div>

      {/* ডান পাশ: কাস্টম ডিজিটাল শেয়ার বাটন */}
      <div className="w-full sm:w-auto flex justify-end shrink-0 border-t border-gray-800/40 sm:border-none pt-4 sm:pt-0">
        <button
          onClick={handleShare}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#00E5FF]/10 to-[#00E5FF]/5 hover:from-[#00E5FF]/20 hover:to-[#00E5FF]/10 active:scale-95 text-xs font-black rounded-xl border border-[#00E5FF]/20 text-[#00E5FF] flex items-center justify-center gap-2.5 transition-all cursor-pointer outline-none shadow-lg shadow-cyan-950/20 group hover:border-[#00E5FF]/40"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          {shareText}
        </button>
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
