import { NextResponse } from 'next/server';

interface Match {
  id: {
    toString(): string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const FIREBASE_URL = "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  
  // 🟢 ম্যাজিক: নিজের সাইটকে কল না করে সরাসরি গোপন সিন্দুক (Env Variable) থেকে ডাটা নিচ্ছি
  const HF_SECRET_URL = process.env.API_URL; 

  try {
    // ১. ফায়ারবেস থেকে লাইভ স্ট্রিম লিংক নেওয়া
    const res = await fetch(`${FIREBASE_URL}/live-streams/${id}.json`, { cache: 'no-store' });
    const streamsData = res.ok ? await res.json() : null;

    // ২. Hugging Face-এর সিক্রেট লিংক থেকে সরাসরি ম্যাচের ডাটা নেওয়া (নেক্সট-জেএস এর ইন্টারনাল কল বাঁচানো হলো)
    let currentMatch = null;
    
    if (HF_SECRET_URL) {
      const matchRes = await fetch(HF_SECRET_URL, { cache: 'no-store' });
      if (matchRes.ok) {
        const matches = await matchRes.json();
        currentMatch = matches?.find((m: Match) => m.id.toString() === id);
      } else {
        console.error("Failed to fetch from HF Secret URL");
      }
    } else {
      console.error("MY_SECRET_API_URL is not set in Vercel Environment Variables");
    }

    // ৩. ডাটা ফ্রন্টএন্ডে পাঠিয়ে দেওয়া
    return NextResponse.json({
      streams: streamsData || [],
      matchInfo: currentMatch || null
    }, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
