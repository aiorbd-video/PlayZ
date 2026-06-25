import { Suspense } from 'react';
import ClientPage from './ClientPage';

export async function generateStaticParams() {
  return [{ id: '1' }]; 
}

// এখানে কোনো params পাঠানো হচ্ছে না, কারণ ClientPage নিজে থেকেই তা ম্যানেজ করে নেবে
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#11131A]"></div>}>
      <ClientPage />
    </Suspense>
  );
}
