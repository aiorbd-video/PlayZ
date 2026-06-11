import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // ফ্রন্টএন্ড থেকে পাঠানো টোকেন বডি থেকে রিসিভ করা
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Captcha token required" }, { status: 400 });
    }

    // 🛡️ ক্লাউডফ্লেয়ার Turnstile এপিআই ভেরিফিকেশন কল
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.CLOUDFLARE_SECRET_KEY || "0x4AAAAAABgwtjiZwrO5JxPdx_AyT7Mm8Bg",
        response: token
      })
    });

    const captchaResult = await verifyRes.json();

    // ভেরিফিকেশন ফেইল করলে ডাটা লক থাকবে
    if (!captchaResult.success) {
      return NextResponse.json({ error: "Bot detected! Access denied." }, { status: 403 });
    }

    // 🟢 ক্যাপচা সফল হলে ফায়ারবেস থেকে লাইভ ডাটা লোড হবে
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
    
    if (!data) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    console.error("Secure API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
