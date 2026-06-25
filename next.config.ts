import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // যদি BUILD_MODE 'export' হয়, তবেই এটি স্ট্যাটিক ফাইল বানাবে (মোবাইলের জন্য), 
  // নাহলে Vercel-এর জন্য নরমাল মোডে চলবে।
  ...(process.env.BUILD_MODE === 'export' ? { output: 'export' } : {}),
  
  images: { 
    unoptimized: true 
  }
};

export default nextConfig;
