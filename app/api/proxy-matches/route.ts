import { NextResponse } from 'next/server';

export async function GET() {
  try {
        const FULL_DATA_URL = process.env.FIREBASE_DATABASE_URL;

    // 🎯 ফিক্স: যদি এনভায়রনমেন্ট ভেরিয়েবল না পাওয়া যায়, তবেই এরর দেখাবে
    if (!FULL_DATA_URL) {
      return NextResponse.json({ error: "Missing Firebase URL" }, { status: 500 });
    }

    const response = await fetch(FULL_DATA_URL, {
      next: { tags: ['firebase-streams'] },
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
          // 🎯 CDN-কে বলা হলো ডাটা ক্যাশ রাখো, আমরা ম্যানুয়ালি পুশ না করা পর্যন্ত ক্লিয়ার করিও না
          'Cache-Control': 'public, s-maxage=31536000, stale-while-revalidate=10',
        },
      }
    );
    
  } catch (error) {
    console.error("Proxy Match API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
