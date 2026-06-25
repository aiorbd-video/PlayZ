export const dynamic = 'force-static';

// আপনার বাকি কোড নিচে যেমন ছিল তেমনই থাকবে...

  //

import { NextResponse } from 'next/server';

export async function GET() {
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;

  if (!FIREBASE_URL) {
    return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    
    // ফায়ারবেস থেকে ফ্রেশ ডাটা আনা হচ্ছে
    const res = await fetch(`${cleanDbUrl}/sports-channels.json`, { cache: 'no-store' });
    const data = await res.json();

    // আপনার ফায়ারবেসের ডাটা স্ট্রাকচার অনুযায়ী API Key প্রসেস করা হচ্ছে
    const channels = data ? Object.keys(data).map(key => {
      const ch = data[key];
      let apiStr = "";
      
      // যদি API টা Object আকারে থাকে (যেমন আপনার ছবিতে আছে)
      if (typeof ch.api === 'object' && ch.api !== null) {
        const kid = Object.keys(ch.api)[0]; // প্রথম Key টা নেবে
        const keyVal = ch.api[kid];         // ভ্যালু টা নেবে
        apiStr = `${kid}:${keyVal}`;
      } else if (typeof ch.api === 'string') {
        apiStr = ch.api;
      }

      return { id: key, ...ch, api: apiStr };
    }) : [];

    // 🟢 এন্টারপ্রাইজ ফিক্স: ৩০ সেকেন্ডের স্মার্ট Edge Caching হেডার যুক্ত করা হলো
    // এটি ৩০ সেকেন্ড পর্যন্ত ডাটা সম্পূর্ণ ক্যাশ রাখবে এবং ব্যাকগ্রাউন্ডে অটো-রিভ্যালিডেট করবে।
    return new NextResponse(JSON.stringify({ channels }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      },
    });

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
