import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 🚀 তোমার নতুন হাগিং ফেস API লিংক (সরাসরি ইভেন্ট ডাটার জন্য)
    const FULL_DATA_URL = "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/playz-streams";

    const response = await fetch(FULL_DATA_URL, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from HF Server" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Proxy Match API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
