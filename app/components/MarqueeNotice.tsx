'use client';

// 🟢 মেইন ইমপোর্টগুলো যুক্ত করা হলো
import useSWR from 'swr';
import { fetcher } from '../utils/helpers'; 

export default function MarqueeNotice() {
  const { data } = useSWR('/api/notice', fetcher, { 
    refreshInterval: 30000,
    revalidateOnFocus: false 
  });

  if (!data || !data.notice || data.notice.trim() === "" || data.notice === "null") {
    return null;
  }

  return (
    <div className="w-full bg-[#1C1E2B] border-b border-gray-800/50 text-[#00E5FF] py-2 overflow-hidden flex items-center shadow-md">
      <div className="bg-red-500 text-white text-[11px] md:text-xs font-black px-3 py-1 rounded-r-md z-10 shrink-0 uppercase tracking-wider shadow-md animate-pulse">
        Notice
      </div>
      {/* @ts-ignore */}
      <marquee 
        behavior="scroll" 
        direction="left" 
        scrollamount="5" 
        className="text-xs md:text-sm font-bold tracking-wide pl-4"
      >
        {data.notice}
      </marquee>
    </div>
  );
}
