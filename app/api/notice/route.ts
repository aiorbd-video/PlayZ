import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 🔒 সার্ভার টু সার্ভার রিকোয়েস্ট - এই লিংকটি ব্রাউজারের নেটওয়ার্ক ট্যাবে দেখাবে না
    const firebaseRes = await fetch(
      'https://ratul-liv-default-rtdb.asia-southeast1.firebasedatabase.app/homepage_notice.json', 
      { cache: 'no-store' }
    );
    
    const noticeText = await firebaseRes.json();
    return NextResponse.json({ notice: noticeText || null });
  } catch (error) {
    return NextResponse.json({ notice: null });
  }
}
