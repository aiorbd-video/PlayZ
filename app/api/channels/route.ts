import { NextResponse } from 'next/server';

export async function GET() {
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;

  if (!FIREBASE_URL) {
    return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    const res = await fetch(`${cleanDbUrl}/sports-channels.json`, { cache: 'no-store' });
    const data = await res.json();

    // 🟢 আপনার ফায়ারবেসের ডাটা স্ট্রাকচার অনুযায়ী API Key প্রসেস করা হচ্ছে
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

    return NextResponse.json({ channels }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
