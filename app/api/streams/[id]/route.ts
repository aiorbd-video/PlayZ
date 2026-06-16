import { NextResponse } from 'next/server';

interface Match {
  id: {
    toString(): string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 🟢 ফিক্স: ফায়ারবেস লিংক সরাসরি কোডে না রেখে Vercel Environment Variable থেকে আনা হচ্ছে
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;
  const HF_BASE_URL = process.env.API_URL || "https://ratulxadia-ratulloveadia.hf.space"; 

  // সেফটি চেক: যদি সিন্দুকে লিংক সেট করা না থাকে
  if (!FIREBASE_URL) {
    console.error("🚨 FIREBASE_DB_URL is not set in Vercel Environment Variables");
    return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
  }

  try {
    // ১. ফায়ারবেস থেকে লাইভ স্ট্রিম লিংক নেওয়া
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    const res = await fetch(`${cleanDbUrl}/live-streams/${id}.json`, { cache: 'no-store' });
    const streamsData = res.ok ? await res.json() : null;

    // ২. Hugging Face-এর বেজ লিংকের সাথে ফাইলের পাথ সেফলি জোড়া লাগানো হচ্ছে
    let currentMatch = null;
    const cleanBaseUrl = HF_BASE_URL.endsWith('/') ? HF_BASE_URL.slice(0, -1) : HF_BASE_URL;
    const FULL_DATA_URL = `${cleanBaseUrl}/get-data/categories/live-events.txt`;

    const matchRes = await fetch(FULL_DATA_URL, { cache: 'no-store' });
    if (matchRes.ok) {
      const matches = await matchRes.json();
      currentMatch = matches?.find((m: Match) => m.id.toString() === id);
    } else {
      console.error("Failed to fetch data from Hugging Face path");
    }

    // ৩. ডাটা ফ্রন্টএন্ডে পাঠানো
    return NextResponse.json({
      streams: streamsData || [],
      matchInfo: currentMatch || null
    }, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
