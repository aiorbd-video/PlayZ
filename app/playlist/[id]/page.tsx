'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fetcher } from '../../utils/helpers';
import { SmartImage } from '../../components/Cards';

export default function PlaylistPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [searchInp, setSearchInp] = useState('');
  const [playlistChannels, setPlaylistChannels] = useState<any[]>([]);

  const { data: m3uData } = useSWR('/api/m3u', fetcher);
  const playlistInfo = m3uData?.channels?.find((c: any) => c.id === id);

  const { data: rawM3uText } = useSWR(
    playlistInfo?.link || null, 
    (url: string) => fetch(url).then(res => res.text()), 
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  useEffect(() => {
    if (!rawM3uText) return;
    const lines = rawM3uText.split('\n');
    const parsedChannels = [];
    let currentChannel: any = {};

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('#EXTINF')) {
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) currentChannel.logo = logoMatch[1];
        const nameSplit = line.split(',');
        currentChannel.name = nameSplit[nameSplit.length - 1].trim();
      } else if (line.startsWith('http')) {
        currentChannel.link = line;
        if (currentChannel.name) parsedChannels.push(currentChannel);
        currentChannel = {};
      }
    }
    setPlaylistChannels(parsedChannels);
  }, [rawM3uText]);

  const filteredChannels = useMemo(() => {
    return playlistChannels.filter(ch => ch.name.toLowerCase().includes(searchInp.toLowerCase()));
  }, [playlistChannels, searchInp]);

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-10">
      <nav className="p-4 bg-[#1C1E2B] sticky top-0 z-50 border-b border-[#2A8496]/30 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button onClick={() => router.back()} className="text-[#00E5FF] font-bold flex items-center gap-2 outline-none cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <span className="text-lg font-bold text-[#00E5FF] truncate">{playlistInfo?.name || "Loading..."}</span>
          <div className="w-6"></div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 mt-6">
        <input
          type="text"
          placeholder={`Search from ${playlistChannels.length || '...'} channels...`}
          value={searchInp}
          onChange={(e) => setSearchInp(e.target.value)}
          className="w-full max-w-md bg-[#1C1E2B] border border-gray-700/50 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-[#00E5FF] text-white shadow-inner mb-6"
        />

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3 md:gap-4">
          {filteredChannels.map((ch, idx) => (
            <motion.div key={idx} whileTap={{ scale: 0.95 }} className="w-full">
              <Link href={`/play?url=${encodeURIComponent(ch.link)}&title=${encodeURIComponent(ch.name)}&playlistId=${id}`} className="outline-none block h-full">
                <div className="bg-[#1C1E2B] border border-[#2A8496]/50 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center aspect-[4/5] hover:border-[#00E5FF] hover:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all group overflow-hidden">
                  
                  {/* 🟢 ইমেজ সাইজ ফিক্সড করা হলো, যাতে কোনোভাবেই স্ক্রিন ব্রেক না করে */}
                  <div className="w-[50px] h-[50px] md:w-[70px] md:h-[70px] rounded-full bg-white flex items-center justify-center overflow-hidden mb-2 shadow-inner border border-gray-300 transition-transform group-hover:scale-110">
                    <SmartImage src={ch.logo} alt={ch.name} width={80} height={80} className="object-contain p-1" />
                  </div>
                  
                  <span className="font-semibold text-[10px] sm:text-xs md:text-sm text-gray-200 text-center truncate w-full px-1">{ch.name}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
