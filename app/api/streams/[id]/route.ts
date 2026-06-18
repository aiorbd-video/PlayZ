import { NextResponse } from 'next/server';

interface Match {
  id: {
    toString(): string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;
  const HF_BASE_URL = process.env.API_URL; 

  if (!FIREBASE_URL || !HF_BASE_URL) {
    console.error("🚨 Environment variables (FIREBASE_DB_URL or API_URL) are missing!");
    return NextResponse.json({ error: "Database or API configuration missing" }, { status: 500 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    const res = await fetch(`${cleanDbUrl}/live-streams/${id}.json`, { cache: 'no-store' });
    const streamsData = res.ok ? await res.json() : null;

    let currentMatch = null;
    const cleanBaseUrl = HF_BASE_URL.endsWith('/') ? HF_BASE_URL.slice(0, -1) : HF_BASE_URL;
    const FULL_DATA_URL = `${cleanBaseUrl}/get-data/categories/live-events.txt`;

    const matchRes = await fetch(FULL_DATA_URL, { cache: 'no-store' });
    if (matchRes.ok) {
      const matches = await matchRes.json();
      currentMatch = matches?.find((m: Match) => m.id.toString() === id);
    }

    // 🟢 এন্টারপ্রাইজ ফিক্স: ফায়ারবেস ও এপিআই ব্যান্ডউইথ বাঁচাতে ৩০ সেকেন্ডের Edge Caching হেডার যুক্ত করা হলো
    // এটি ৩০ সেকেন্ড পর্যন্ত ডাটা Vercel CDN-এ ক্যাশ রাখবে এবং ব্যাকগ্রাউন্ডে অটো-রিভ্যালিডেট করবে।
    return new NextResponse(
      JSON.stringify({
        streams: streamsData || [],
        matchInfo: currentMatch || null
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
        },
      }
    );

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
