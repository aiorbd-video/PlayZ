'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

const fetcher = (url: string) => fetch(url).then(res => res.json());

const getImg = (url: string | undefined | null) => {
  if (!url || url === "null" || url === "") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

export default function PlaylistPage() {
  const { id } = useParams();
  const { data, error } = useSWR('/api/m3u', fetcher);
  
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInp, setSearchInp] = useState('');

  const playlistInfo = data?.channels?.find((c: any) => c.id === id);

  useEffect(() => {
    if (!data) return;
    if (playlistInfo && playlistInfo.link) {
      // 🟢 M3U ফাইল স্ক্যানার
      fetch(playlistInfo.link)
        .then(res => res.text())
        .then(text => {
          const lines = text.split('\n');
          const parsedChannels = [];
          let currentChannel: any = {};

          for (let line of lines) {
            line = line.trim();
            if (line.startsWith('#EXTINF')) {
              // লোগো খুঁজবে (tvg-logo)
              const logoMatch = line.match(/tvg-logo="([^"]+)"/);
              if (logoMatch) currentChannel.logo = logoMatch[1];
              
              // নাম খুঁজবে
              const nameSplit = line.split(',');
              currentChannel.name = nameSplit[nameSplit.length - 1].trim();
            } else if (line.startsWith('http')) {
              currentChannel.link = line;
              if(currentChannel.name) {
                 parsedChannels.push(currentChannel);
              }
              currentChannel = {}; // Reset for next
            }
          }
          setChannels(parsedChannels);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [data, playlistInfo]);

  const filteredChannels = channels.filter(ch => 
    ch.name.toLowerCase().includes(searchInp.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#11131A] text-white font-sans pb-20">
      <nav className="p-4 bg-[#11131A]/90 sticky top-0 z-50 border-b border-gray-800/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <button className="p-2 text-gray-400 hover:text-[#00E5FF] flex items-center gap-2 outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-bold hidden sm:inline">Back</span>
            </button>
          </Link>
          <span className="font-bold text-[#00E5FF] truncate max-w-[150px] sm:max-w-xs">{playlistInfo?.name || "Loading..."}</span>
          <div className="w-10"></div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="mb-6">
          <input 
            type="text" 
            placeholder={`Search from ${channels.length || '...'} channels...`}
            value={searchInp}
            onChange={(e) => setSearchInp(e.target.value)}
            className="bg-[#1C1E2B] border border-gray-800 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-[#00E5FF] text-white"
          />
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#00E5FF]">
            <div className="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="animate-pulse font-bold">Scanning M3U Playlist...</p>
          </div>
        )}

        {!loading && filteredChannels.length === 0 && (
          <div className="text-center py-10 text-gray-500 font-bold">No channels found.</div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredChannels.map((ch, index) => (
            <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.95 }}>
              {/* 🟢 প্লে করার জন্য ইউনিভার্সাল প্লেয়ার পেজে পাঠানো হচ্ছে */}
              <Link href={`/play?url=${encodeURIComponent(ch.link)}&title=${encodeURIComponent(ch.name)}`} className="outline-none">
                <div className="bg-[#1C1E2B] border border-gray-800/80 rounded-xl p-4 flex flex-col items-center gap-3 hover:border-[#00E5FF]/50 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-black/40 flex items-center justify-center overflow-hidden p-1">
                     <Image src={getImg(ch.logo)} alt={ch.name} width={50} height={50} className="object-contain" unoptimized />
                  </div>
                  <span className="font-bold text-xs text-gray-200 text-center truncate w-full">{ch.name}</span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
