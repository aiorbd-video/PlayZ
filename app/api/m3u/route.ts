import { NextResponse } from 'next/server';

export async function GET() {
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;
  if (!FIREBASE_URL) return NextResponse.json({ error: "Missing DB URL" }, { status: 500 });

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    
    // 🟢 ডাবল-লক ফিক্স: মডিফাই করা হলো
    const res = await fetch(`${cleanDbUrl}/m3u-channels.json`, { 
      next: { revalidate: 60 } 
    });
    
    const data = await res.json();
    const channels = data ? Object.keys(data).map(key => {
      const ch = data[key];
      let apiStr = "";
      if (typeof ch.api === 'object' && ch.api !== null) {
        const kid = Object.keys(ch.api)[0];
        apiStr = `${kid}:${ch.api[kid]}`;
      } else if (typeof ch.api === 'string') {
        apiStr = ch.api;
      }
      return { id: key, ...ch, api: apiStr };
    }) : [];

    return new NextResponse(JSON.stringify({ channels }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error) { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}
