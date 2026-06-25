import { Suspense } from 'react';
import ClientPage from './ClientPage';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#11131A] flex justify-center items-center"><span className="text-[#00E5FF] animate-pulse">Loading...</span></div>}>
      <ClientPage />
    </Suspense>
  );
}
