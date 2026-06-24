import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // URL থেকে টাইপ এবং আইডি বের করে আনা হচ্ছে
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  try {
    // ==========================================
    // ১. Live Events (Matches) ফেচ করার লজিক
    // ==========================================
    if (type === 'matches') {
      const apiUrl = process.env.LIVE_EVENTS_API;
      if (!apiUrl) return NextResponse.json({ error: 'LIVE_EVENTS_API is missing' }, { status: 500 });
      
      const res = await fetch(apiUrl, { cache: 'no-store' });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // ==========================================
    // ২. Stream API ফেচ করার লজিক
    // ==========================================
    if (type === 'stream') {
      const streamBaseUrl = process.env.STREAM_API_BASE;
      if (!streamBaseUrl || !id) return NextResponse.json({ error: 'STREAM_API_BASE or ID is missing' }, { status: 500 });
      
      const res = await fetch(`${streamBaseUrl}${id}`, { cache: 'no-store' });
      const data = await res.json();
      return NextResponse.json(data);
    }

    // ==========================================
    // ৩. Firebase Channels ফেচ করার লজিক (আপনার আগের কোড)
    // ==========================================
    if (type === 'channels') {
      const FULL_DATA_URL = process.env.FIREBASE_DATABASE_URL;
      
      if (!FULL_DATA_URL) {
        return NextResponse.json({ error: "Missing Firebase URL" }, { status: 500 });
      }

      const response = await fetch(FULL_DATA_URL, {
        next: { tags: ['firebase-streams'] },
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Firebase responded with status ${response.status}` }, 
          { status: response.status }
        );
      }

      const data = await response.json();

      return new NextResponse(
        JSON.stringify(data || {}),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=10',
          },
        }
      );
    }

    // যদি ভুল কোনো টাইপ দেওয়া হয়
    return NextResponse.json({ error: 'Invalid API Type requested' }, { status: 400 });

  } catch (error) {
    console.error(`Proxy API Error [${type}]:`, error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
