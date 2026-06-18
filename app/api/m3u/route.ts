import { NextResponse } from 'next/server';

export async function GET() {
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;

  if (!FIREBASE_URL) {
    return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    
    // ফায়ারবেসের m3u-channels থেকে ফ্রেশ ডাটা আনা হচ্ছে
    const res = await fetch(`${cleanDbUrl}/m3u-channels.json`, { cache: 'no-store' });
    const data = await res.json();

    const channels = data ? Object.keys(data).map(key => {
      const ch = data[key];
      let apiStr = "";
      
      if (typeof ch.api === 'object' && ch.api !== null) {
        const kid = Object.keys(ch.api)[0];
        const keyVal = ch.api[kid];
        apiStr = `${kid}:${keyVal}`;
      } else if (typeof ch.api === 'string') {
        apiStr = ch.api;
      }

      return { id: key, ...ch, api: apiStr };
    }) : [];

    // 🟢 এন্টারপ্রাইজ ফিক্স: ফায়ারবেস ব্যান্ডউইথ বাঁচাতে ৩০ সেকেন্ডের Edge Caching হেডার যুক্ত করা হলো
    // এটি ৩০ সেকেন্ড পর্যন্ত ডাটা Vercel CDN-এ ক্যাশ রাখবে এবং ব্যাকগ্রাউন্ডে অটো-রিভ্যালিডেট করবে।
    return new NextResponse(JSON.stringify({ channels }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      },
    });

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch M3U channels" }, { status: 500 });
  }
}
