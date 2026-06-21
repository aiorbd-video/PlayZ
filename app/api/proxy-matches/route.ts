import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const FULL_DATA_URL = "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/playz-streams.json";

    // 🎯 ফিক্স: cache: 'no-store' ফেলে দিয়ে ২০ সেকেন্ডের ক্যাশ টাইম সেট করা হলো
    const response = await fetch(FULL_DATA_URL, {
      next: { revalidate: 60 }, // ঠিক ২০ সেকেন্ড পর পর সার্ভার ফায়ারবেস থেকে নতুন ডাটা নিবে
      headers: {
        'Accept': 'application/json',
      }
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
          // 🎯 ব্রাউজার এবং CDN লেভেলে ক্যাশ কন্ট্রোল (ব্যান্ডউইথ প্রটেকশন)
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=5',
        },
      }
    );
    
  } catch (error) {
    console.error("Proxy Match API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
