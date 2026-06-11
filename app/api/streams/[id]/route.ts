import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Promise থেকে id বের করা (Next.js 15+ রুলস)
  const { id } = await params;
  
  // 🟢 আপনার আসল ডাটাবেস লিংকটি এখন সার্ভারের ভেতরে লক করা থাকলো (কেউ দেখতে পারবে না)
  const FIREBASE_URL = "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
  
  try {
    const res = await fetch(`${FIREBASE_URL}/live-streams/${id}.json`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 });
    }
    
    const data = await res.json();
    
    // ডাটা যদি null হয় (অর্থাৎ ডাটাবেসে কিছু নেই)
    if (!data) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
