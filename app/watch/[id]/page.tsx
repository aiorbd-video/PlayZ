import { Suspense } from 'react';
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [{ id: '1' }]; 
}

// Next.js-এর searchParams এরর বাইপাস করার জন্য Suspense এবং শুধু params পাঠানো হলো
export default function Page({ params }: any) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#11131A]"></div>}>
      <ClientPage params={params} />
    </Suspense>
  );
}
