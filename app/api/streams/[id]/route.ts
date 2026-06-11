import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // ১. Promise থেকে id বের করা (Next.js 15+ রুলস)
    const { id } = await params;
    
    // ২. ফ্রন্টএন্ড থেকে পাঠানো ক্যাপচা টোকেন রিসিভ করা
    const { token } = await request.json();

    // যদি ফ্রন্টএন্ড থেকে কোনো টোকেন না আসে
    if (!token) {
      return NextResponse.json({ error: "Captcha token required" }, { status: 400 });
    }

    // ৩. 🟢 Cloudflare Turnstile সার্ভারে ফ্রিতে টোকেন ভেরিফাই করা
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.CLOUDFLARE_SECRET_KEY, // Vercel এনভায়রনমেন্ট ভেরিয়েবল থেকে আসবে
        response: token
      })
    });

    const captchaResult = await verifyRes.json();

    // যদি ক্যাপচা ভেরিফিকেশন ফেইল করে (কোনো বট বা স্ক্রিপ্ট হলে)
    if (!captchaResult.success) {
      return NextResponse.json({ error: "Bot detected! Access denied." }, { status: 403 });
    }

    // ৪. 🟢 ক্যাপচা পাস করলে ফায়ারবেস থেকে ডাটা ফেচ করা
    const FIREBASE_URL = process.env.FIREBASE_DB_URL || "https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app";
    
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

    // সম্পূর্ণ সিকিউরড ডাটা ইউজারকে রিটার্ন করা
    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
