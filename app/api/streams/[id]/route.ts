import { NextResponse } from 'next/server';

interface Match {
  id: {
    toString(): string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const FIREBASE_URL = "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  const MATCH_API = "https://ratulxlive.vercel.app/api/proxy-matches"; // আপনার মেইন ম্যাচ এপিআই

  try {
    // ১. ফায়ারবেস থেকে স্ট্রিম লিংক নেওয়া
    const res = await fetch(`${FIREBASE_URL}/live-streams/${id}.json`, { cache: 'no-store' });
    const streamsData = res.ok ? await res.json() : null;

    // ২. ম্যাচ এপিআই থেকে টাইটেল ও ছবির ডাটা নেওয়া (মেটাডাটার ব্যাকআপের জন্য)
    const matchRes = await fetch(MATCH_API, { cache: 'no-store' });
    const matches = matchRes.ok ? await matchRes.json() : [];
    const currentMatch = matches?.find((m: Match) => m.id.toString() === id);

    return NextResponse.json({
      streams: streamsData || [],
      matchInfo: currentMatch || null
    }, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
