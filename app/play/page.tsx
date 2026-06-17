'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// 🟢 ডাইনামিক ইম্পোর্ট: Shaka Player কে সার্ভার সাইড রেন্ডারিং (SSR) থেকে ব্লক করা হলো
// এতে বিল্ডের সময় "document is not defined" এরর আর আসবে না।
const ShakaPlayerComponent = dynamic(() => import('./PlayerComponent'), { 
  ssr: false, 
  loading: () => (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#00E5FF]">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse font-bold">Loading Universal Player...</p>
      </div>
    </div>
  ) 
});

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ShakaPlayerComponent />
    </Suspense>
  );
}
