import { NextResponse } from 'next/server';

interface Match {
  id: {
    toString(): string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // 🟢 কোনো লিংক নেই, ফায়ারবেস এবং এপিআই দুইটাই সিন্দুক থেকে আসবে
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

    return NextResponse.json({
      streams: streamsData || [],
      matchInfo: currentMatch || null
    }, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
