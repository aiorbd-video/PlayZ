'use client';

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import { MatchCountdown, MatchCard } from './MatchCardComponents'; // 🎯 আপনার তৈরি করা কম্পোনেন্টগুলোর পাথ দিন

const PROXY_MATCHES_API = '/api/proxy-matches';
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MatchListBottom({ currentMatchId }: { currentMatchId: string }) {
  const { data: rawMatches, error } = useSWR(PROXY_MATCHES_API, fetcher, {
    refreshInterval: 20000, // ২০ সেকেন্ড পর পর ফ্রেশ ডাটা রিফ্রেশ হবে
    revalidateOnFocus: false,
  });

  const [liveMatches, setLiveMatches] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);

  useEffect(() => {
    if (!rawMatches || typeof rawMatches !== 'object') return;

    const now = new Date().getTime();
    const liveList: any[] = [];
    const upcomingList: any[] = [];

    // ফায়ারবেস অবজেক্ট ডাটা ফরম্যাটকে অ্যারে-তে রূপান্তর ও ফিল্টারিং
    Object.entries(rawMatches).forEach(([key, value]: [string, any]) => {
      // বর্তমানে যে ম্যাচটি প্লেয়ারে চলছে, সেটিকে নিচের লিস্টে দেখাবো না
      if (key === currentMatchId) return;

      const eventInfo = value.eventInfo || value.event || {};
      const matchObj = {
        id: key,
        eventInfo: eventInfo,
      };

      const startTimeStr = eventInfo.startTime;
      const startTime = startTimeStr ? new Date(startTimeStr).getTime() : null;

      // ম্যাচ স্ট্যাটাস ক্যালকুলেশন (লাইভ নাকি আপকামিং)
      // যদি ম্যাচ শুরুর সময় পার হয়ে যায় এবং বর্তমানের কাছাকাছি থাকে তবে লাইভ, নতুবা আপকামিং
      if (startTime && now >= startTime - 15 * 60 * 1000) {
        // খেলা শুরুর ১৫ মিনিট আগে থেকেই ওটাকে লাইভ ট্যাবে পুশ করা হবে
        liveList.push(matchObj);
      } else {
        upcomingList.push(matchObj);
      }
    });

    setLiveMatches(liveList);
    setUpcomingMatches(upcomingList);
  }, [rawMatches, currentMatchId]);

  if (error) return null;
  if (!rawMatches || (liveMatches.length === 0 && upcomingMatches.length === 0)) return null;

  return (
    <div className="w-full mt-8 border-t border-gray-800/60 pt-6">
      {/* 🔴 লাইভ ম্যাচ সেকশন */}
      {liveMatches.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <h2 className="text-base md:text-lg font-bold text-white tracking-wide uppercase">More Live Matches</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} status="live" />
            ))}
          </div>
        </div>
      )}

      {/* 🗓️ আপকামিং ম্যাচ সেকশন */}
      {upcomingMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF]"></span>
            <h2 className="text-base md:text-lg font-bold text-white tracking-wide uppercase">Upcoming Matches</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} status="upcoming" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
