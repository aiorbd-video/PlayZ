import type { NextConfig } from "next";
// @ts-ignore
import withObfuscator from 'next-javascript-obfuscator';

const obfuscatorConfig = withObfuscator({
  compact: true,
  controlFlowFlattening: true,       // কোডের ভেতরের লজিক এলোমেলো করে দেবে
  deadCodeInjection: true,           // ফালতু কোড ঢুকিয়ে হ্যাকারকে কনফিউজড করবে
  stringArrayEncoding: ['base64'],   // আপনার এপিআই পাথ ও স্ট্রিংগুলো এনক্রিপ্ট করে দেবে
  splitStrings: true
});

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/proxy-cats',
        destination: 'https://ratul-api-all-in-one.onrender.com/event-cats',
      },
      {
        source: '/api/proxy-matches',
        destination: 'https://ratul-api-all-in-one.onrender.com/get-data/categories/live-events.txt',
      }
    ];
  },
};

// অবফাসকেটর দিয়ে কনফিগারেশনটি লক করে এক্সপোর্ট করা হলো
export default obfuscatorConfig(nextConfig);
