'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MarqueeNotice() {
  // ৩০ সেকেন্ড পর পর অটোমেটিক ফায়ারবেস থেকে নতুন নোটিশ চেক করবে
  const { data } = useSWR('/api/notice', fetcher, { refreshInterval: 30000 });

  // 🟢 লজিক: ফায়ারবেসে নোটিশ না থাকলে বা ডাটা খালি থাকলে মারকুই স্ক্রিনে দেখাবেই না (সম্পূর্ণ হাইড)
  if (!data || !data.notice || data.notice.trim() === "" || data.notice === "null") {
    return null;
  }

  return (
    <div className="w-full bg-[#1C1E2B] border-b border-gray-800/80 text-[#00E5FF] py-2 overflow-hidden flex items-center shadow-md">
      {/* 📢 নোটিশ ট্যাগ */}
      <div className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-r-md z-10 shrink-0 uppercase tracking-wider shadow-md animate-pulse">
        Notice
      </div>

      {/* 🏃‍♂️ মারকুই টেক্সট (ওয়েবভিউ এবং সব ব্রাউজারে ১০০% স্মুথলি স্ক্রোল হবে) */}
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
