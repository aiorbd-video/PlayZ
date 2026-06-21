import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🎯 ১. নেক্সটজেএস ১৫+ স্ট্যান্ডার্ড অনুযায়ী Async params হ্যান্ডেল করা
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  const FIREBASE_URL = process.env.FIREBASE_DB_URL;

  if (!FIREBASE_URL) {
    return NextResponse.json({ error: "Firebase DB URL Config missing" }, { status: 500 });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing or invalid ID/Slug" }, { status: 400 });
  }

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    
    // 🎯 ২. পাইথন বটের সাথে পাথ মিলানো হলো (live-streams এর বদলে playz-streams)
    // 🎯 ৩. লাইভ টোকেন সেফটির জন্য ৩০ সেকেন্ড রিলিজ ক্যাশ রাখা হলো
    const res = await fetch(`${cleanDbUrl}/playz-streams/${id}.json`, { 
      next: { revalidate: 60 } 
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Firebase responded with status ${res.status}` }, { status: 502 });
    }

    const matchData = await res.json();

    // যদি ফায়ারবেসে এই স্ল্যাগের কোনো ডাটা না থাকে
    if (!matchData) {
      return NextResponse.json({ streams: [], matchInfo: null, message: "No active match found" }, { status: 200 });
    }

    // 🎯 ৪. পাইথন বটের পাঠানো ডাটা স্ট্রাকচার অনুযায়ী ফ্রন্টএন্ডে ক্লিন ডাটা পাঠানো
    // পাইথন বটের ডাটাতে 'streams' এবং অন্যান্য ইনফো একসাথে অবজেক্ট আকারে থাকে
    const streamsList = matchData.streams || [];
    
    return new NextResponse(
      JSON.stringify({ 
        streams: streamsList, 
        matchInfo: matchData // ফ্রন্টএন্ডে ব্যবহারের জন্য পুরো ম্যাচ ডেটা পাঠিয়ে দেওয়া হলো
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // ব্রাউজার এবং সিডিএন লেভেলে ৩০ সেকেন্ড ক্যাশ কন্ট্রোল (Zero Server Loading)
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
        },
      }
    );
  } catch (error) {
    console.error("Next.js Stream API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
