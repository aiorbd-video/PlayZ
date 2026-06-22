'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface PlayerLogsHandle {
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

export const PlayerLogs = forwardRef<PlayerLogsHandle>((_, ref) => {
  // ব্যাকগ্রাউন্ডে লগ রিসিভ সচল রাখা হলো (টাইপস্ক্রিপ্ট সেফটির জন্য)
  const [p2pPeers, setP2pPeers] = useState<number>(0);
  const [p2pSavedKB, setP2pSavedKB] = useState<number>(0);
  const [currentStatus, setCurrentStatus] = useState<{ msg: string; type: string }>({
    msg: 'ইঞ্জিন প্রস্তুত। লাইভ স্ট্রিম কানেক্ট হচ্ছে...',
    type: 'info'
  });

  useImperativeHandle(ref, () => ({
    addLog: (message: string, type = 'info') => {
      // ১. টেকনিক্যাল লগের ভেতর থেকে P2P ডাটা ফিল্টার করে রিয়েল-টাইম ড্যাশবোর্ডে রূপান্তর
      if (message.includes('New Peer Connected')) {
        setP2pPeers((prev) => prev + 1);
        setCurrentStatus({ msg: 'নতুন হাই-স্পিড পিয়ার কানেক্টেড!', type: 'success' });
      } 
      else if (message.includes('Downloaded') && message.includes('KB from peers')) {
        const match = message.match(/Downloaded\s+([\d.]+)\s+KB/);
        if (match && match[1]) {
          setP2pSavedKB((prev) => prev + parseFloat(match[1]));
        }
      }
      // ২. সাধারণ ইউজারদের বোঝার মতো করে এরর মেসেজ ট্রান্সলেট করা
      else if (type === 'error' || message.includes('Failed')) {
        setCurrentStatus({ msg: 'নেটওয়ার্ক ড্রপ হয়েছে। বিকল্প সার্ভারে অটো-শিফট করা হচ্ছে...', type: 'error' });
      } 
      else if (message.includes('live on-screen')) {
        setCurrentStatus({ msg: 'লাইভ ব্রডকাস্ট সফলভাবে সচল হয়েছে। এনজয় করুন!', type: 'success' });
      }
      else if (message.includes('Autoplay deferred')) {
        setCurrentStatus({ msg: 'ব্রাউজার অটো-প্লে ব্লক করেছে। স্ক্রিনের প্লে বাটনে ক্লিক করুন।', type: 'warn' });
      }
    },
    clearLogs: () => {
      setP2pPeers(0);
      setP2pSavedKB(0);
    },
  }));

  return (
    <div className="mt-6 bg-[#161824] rounded-2xl border border-gray-800/80 shadow-2xl overflow-hidden">
      {/* টপ বার: সার্ভার হেলথ */}
      <div className="p-4 bg-gray-950/50 border-b border-gray-850 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
            Stream Optimizer Dashboard
          </span>
        </div>
        
        {/* রিয়েল-টাইম কানেকশন স্ট্যাটাস */}
        <div className={`text-xs font-medium px-3 py-1 rounded-full border bg-opacity-10 ${
          currentStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
          currentStatus.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
          currentStatus.type === 'warn' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
          'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
        }`}>
          {currentStatus.msg}
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* কার্ড ১: P2P নেটওয়ার্ক স্ট্যাটাস */}
        <div className="bg-[#1C1F30] p-4 rounded-xl border border-gray-800/50 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">P2P Peer Network</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">অন্যান্য ইউজারদের সাথে শেয়ারিং মোড।</p>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400 tracking-tight">{p2pPeers}</span>
            <span className="text-xs text-gray-400 font-medium">Active Peers</span>
          </div>
        </div>

        {/* কার্ড ২: ব্যান্ডউইথ সেভার */}
        <div className="bg-[#1C1F30] p-4 rounded-xl border border-gray-800/50 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Server Bandwidth Saved</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed">WebRTC টেকনোলজিতে আপনার সাশ্রয়কৃত ডাটা।</p>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 tracking-tight">
              {p2pSavedKB > 1024 ? `${(p2pSavedKB / 1024).toFixed(2)} MB` : `${p2pSavedKB.toFixed(0)} KB`}
            </span>
            <span className="text-xs text-gray-400 font-medium">Data Saved</span>
          </div>
        </div>

        {/* কার্ড ৩: ইউজার গাইড / ট্রাবলশুট */}
        <div className="bg-[#1C1F30] p-4 rounded-xl border border-gray-800/50">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Streaming Guide</h4>
          <ul className="text-[11px] text-gray-400 space-y-1.5 list-disc list-inside">
            <li>ভিডিও ফ্রিজ হলে নিচের <span className="text-[#00E5FF] font-semibold">Servers</span> বাটন চেপে চেঞ্জ করুন।</li>
            <li>কালো স্ক্রিন এসে আটকে থাকলে প্লেয়ারের মাঝখানে ক্লিক করুন।</li>
            <li>সবচেয়ে স্ট্যাবল পারফরম্যান্সের জন্য <span className="text-emerald-400">DASH</span> সার্ভার ব্যবহার করুন।</li>
          </ul>
        </div>
      </div>
    </div>
  );
});

PlayerLogs.displayName = 'PlayerLogs';
