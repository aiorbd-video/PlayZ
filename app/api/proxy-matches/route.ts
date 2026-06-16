import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 🟢 আপনার Vercel-এর Environment Variable (API_URL) থেকে ডাটা নিচ্ছি
    const HF_BASE_URL = process.env.API_URL || "https://ratulxadia-ratulloveadia.hf.space";
    
    // 🟢 বেজ লিংকের সাথে আসল ডাটার ফাইল (live-events.txt) জোড়া লাগানো হচ্ছে
    const cleanBaseUrl = HF_BASE_URL.endsWith('/') ? HF_BASE_URL.slice(0, -1) : HF_BASE_URL;
    const FULL_DATA_URL = `${cleanBaseUrl}/get-data/categories/live-events.txt`;

    const response = await fetch(FULL_DATA_URL, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.error(`HF fetch failed with status: ${response.status}`);
      return NextResponse.json({ error: "Failed to fetch from HF" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Proxy Match API Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
  }
