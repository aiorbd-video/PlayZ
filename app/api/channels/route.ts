import { NextResponse } from 'next/server';

export async function GET() {
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;

  if (!FIREBASE_URL) {
    return NextResponse.json({ error: "Database configuration missing" }, { status: 500 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    // ফায়ারবেস থেকে চ্যানেল লিস্ট আনা হচ্ছে
    const res = await fetch(`${cleanDbUrl}/sports-channels.json`, { cache: 'no-store' });
    const data = await res.json();

    // ফায়ারবেসের ডাটাকে সুন্দর Array তে রূপান্তর করা হচ্ছে
    const channels = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];

    return NextResponse.json({ channels }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
