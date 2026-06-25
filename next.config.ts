import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // যদি Vercel-এ বিল্ড হয়, তবে ফাঁকা থাকবে। আর অন্য কোথাও (গিটহাবে) বিল্ড হলে output: 'export' হবে।
  ...(process.env.VERCEL ? {} : { output: 'export' }),
  
  images: { 
    unoptimized: true 
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
