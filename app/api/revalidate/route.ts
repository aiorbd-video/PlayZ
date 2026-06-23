import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const { secret } = await request.json();
    
    // 🔐 সিকিউরিটি চেক: পাইথন বট আর ভার্সেলের সিক্রেট টোকেন মিলতে হবে
    if (secret !== "RatulSecretToken2026") {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 🔥 পাইথন বটের সিগন্যাল পাওয়া মাত্রই Vercel-এর পুরনো ডাটা ক্যাশ ডিলিট!
    // 🎯 ১ম আর্গুমেন্ট ট্যাগ নেম, ২য় আর্গুমেন্টে আমরা গ্লোবাল টাইপ লক 'layout' বা 'page' পাস করব
revalidateTag('firebase-streams', 'layout');

    
    return NextResponse.json({ revalidated: true, message: 'Vercel Edge Cache Purged Successfully!' });
  } catch (err) {
    return NextResponse.json({ message: 'Error revalidating cache' }, { status: 500 });
  }
}
