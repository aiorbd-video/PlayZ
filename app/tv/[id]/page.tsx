import { Suspense } from 'react';
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [{ id: '1' }]; 
}

export default function Page({ params }: any) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#11131A]"></div>}>
      {/* @ts-ignore - টাইপস্ক্রিপ্টের পণ্ডিতি বন্ধ করার ম্যাজিক ট্রিক */}
      <ClientPage params={params} />
    </Suspense>
  );
}
