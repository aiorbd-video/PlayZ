
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 🔒 Vercel Environment Variable থেকে সিকিউরড উপায়ে বেস ইউআরএল নেওয়া হচ্ছে
    const baseUrl = process.env.FIREBASE_DB_URL;
    
    if (!baseUrl) {
      console.error("❌ FIREBASE_DB_URL is missing in Vercel Env!");
      return NextResponse.json({ notice: null });
    }

    // ইউআরএল-এর শেষে স্ল্যাশ (/) এর ঝামেলা এড়ানোর জন্য ক্লিন পাথ তৈরি
    const cleanUrl = baseUrl.endsWith('/') 
      ? `${baseUrl}homepage_notice.json` 
      : `${baseUrl}/homepage_notice.json`;

    // সার্ভার-টু-সার্ভার ডিরেক্ট ফেচ (সম্পূর্ণ নিরাপদ)
    const firebaseRes = await fetch(cleanUrl, { cache: 'no-store' });
    const noticeText = await firebaseRes.json();
    
    return NextResponse.json({ notice: noticeText || null });
  } catch (error) {
    return NextResponse.json({ notice: null });
  }
}
