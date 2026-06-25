'use client';

import { useSearchParams } from 'next/navigation';
import StreamPlayer from './StreamPlayer';

export default function ClientPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  // আইডি না পাওয়া পর্যন্ত একটি লোডিং স্ক্রিন দেখাবে
  if (!id) {
    return (
      <main className="min-h-screen bg-[#11131A] flex justify-center items-center">
        <span className="text-[#00E5FF] font-bold animate-pulse tracking-widest">
          LOADING...
        </span>
      </main>
    );
  }

  // আপনার আগের লজিক অনুযায়ী লিংকের শেষ থেকে আসল আইডি (realId) বের করা হলো
  const realId = id.includes('-') ? id.split('-').pop() : id;

  return (
    <main className="min-h-screen bg-[#11131A] text-white">
      <div className="max-w-7xl mx-auto">
        <StreamPlayer key={realId as string} id={realId as string} />
      </div>
    </main>
  );
}
