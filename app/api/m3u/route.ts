import { NextResponse } from 'next/server';

export async function GET() {
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;

  if (!FIREBASE_URL) {
    return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    // 🟢 ফায়ারবেসের m3u-channels থেকে ডাটা আনবে
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

    return NextResponse.json({ channels }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch M3U channels" }, { status: 500 });
  }
}
