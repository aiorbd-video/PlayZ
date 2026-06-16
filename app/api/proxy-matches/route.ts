import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 🟢 কোনো হার্ডকোড লিংক নেই, পুরোটাই Vercel এর সিন্দুক থেকে আসবে
    const HF_BASE_URL = process.env.API_URL;
    
    if (!HF_BASE_URL) {
      console.error("🚨 API_URL is not set in environment variables");
      return NextResponse.json({ error: "API Configuration missing" }, { status: 500 });
    }

    const cleanBaseUrl = HF_BASE_URL.endsWith('/') ? HF_BASE_URL.slice(0, -1) : HF_BASE_URL;
    const FULL_DATA_URL = `${cleanBaseUrl}/get-data/categories/live-events.txt`;

    const response = await fetch(FULL_DATA_URL, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch from HF" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Proxy Match API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
