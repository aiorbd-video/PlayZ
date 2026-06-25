export const dynamic = 'force-static';

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
    
    // 🎯 ফিক্স ১: revalidate: 60 ফেলে দিয়ে অন-ডিমান্ড ট্যাগ 'firebase-streams' বসানো হলো
    const res = await fetch(`${cleanDbUrl}/playz-streams/${id}.json`, { 
      next: { tags: ['firebase-streams'] },
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Firebase responded with status ${res.status}` }, { status: 502 });
    }

    const matchData = await res.json();

    if (!matchData) {
      return NextResponse.json({ streams: [], matchInfo: null, message: "No active match found" }, { status: 200 });
    }

    const streamsList = matchData.streams || [];
    
    return new NextResponse(
      JSON.stringify({ 
        streams: streamsList, 
        matchInfo: matchData 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // 🎯 ফিক্স ২: ব্রাউজার মেমোরি লক ভাঙা হলো (max-age=0, must-revalidate)
          // এখন ব্রাউজার প্রতিবার Vercel Edge-এ নক করবে। Vercel মেমোরি থেকে ডাটা দিবে ১ মিলিসেকেন্ডে।
          // আর পাইথন বট ক্যাশ ডিলিট করলে ইউজার সাথে সাথে রিফ্রেশ ছাড়াই ফ্রেশ টোকেন পেয়ে যাবে!
          'Cache-Control': 'public, max-age=0, s-maxage=31536000, must-revalidate, stale-while-revalidate=5',
        },
      }
    );
  } catch (error) {
    console.error("Next.js Stream API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
