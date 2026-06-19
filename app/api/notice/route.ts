import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // ফায়ারবেস ডাটাবেজে 'homepage_notice.json' পাথ থেকে নোটিশ টেক্সট রিড করা হচ্ছে
    const firebaseRes = await fetch(`${process.env.FIREBASE_URL}/homepage_notice.json`, { cache: 'no-store' });
    const noticeText = await firebaseRes.json();

    return NextResponse.json({ notice: noticeText || null });
  } catch (error) {
    return NextResponse.json({ notice: null });
  }
}
