export const dynamic = 'force-static';

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const { secret } = await request.json();
    
    // 🔐 সিকিউরিটি চেক
    if (secret !== "RatulSecretToken2026") {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 🔥 ফিক্সড: layout কন্টেক্সটসহ ২টি আর্গুমেন্ট পাস করা হলো
    revalidateTag('firebase-streams', 'layout');
    
    return NextResponse.json({ revalidated: true, message: 'Vercel Edge Cache Purged Successfully!' });
  } catch (err) {
    return NextResponse.json({ message: 'Error revalidating cache' }, { status: 500 });
  }
}
