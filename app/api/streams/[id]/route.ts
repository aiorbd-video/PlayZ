import { NextResponse } from 'next/server';

interface Match { id: { toString(): string; }; }

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const FIREBASE_URL = process.env.FIREBASE_DB_URL;
  const HF_BASE_URL = process.env.API_URL; 

  if (!FIREBASE_URL || !HF_BASE_URL) return NextResponse.json({ error: "Config missing" }, { status: 500 });

  try {
    const cleanDbUrl = FIREBASE_URL.endsWith('/') ? FIREBASE_URL.slice(0, -1) : FIREBASE_URL;
    
    // 🟢 ডাবল-লক ফিক্স: লাইভ টোকেনের জন্য ৩০ সেকেন্ড সার্ভার ক্যাশ করা হলো
    const res = await fetch(`${cleanDbUrl}/live-streams/${id}.json`, { 
      next: { revalidate: 30 } 
    });
    const streamsData = res.ok ? await res.json() : null;

    let currentMatch = null;
    const cleanBaseUrl = HF_BASE_URL.endsWith('/') ? HF_BASE_URL.slice(0, -1) : HF_BASE_URL;
    
    // Hugging Face বা আপনার অন্য এፒআই-ও ৩০ সেকেন্ড ক্যাশ থাকবে যাতে ওটাও ক্র্যাশ না করে
    const matchRes = await fetch(`${cleanBaseUrl}/get-data/categories/live-events.txt`, { 
      next: { revalidate: 120 } 
    });
    if (matchRes.ok) {
      const matches = await matchRes.json();
      currentMatch = matches?.find((m: Match) => m.id.toString() === id);
    }

    return new NextResponse(
      JSON.stringify({ streams: streamsData || [], matchInfo: currentMatch || null }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
        },
      }
    );
  } catch (error) { return NextResponse.json({ error: "Internal Error" }, { status: 500 }); }
}
