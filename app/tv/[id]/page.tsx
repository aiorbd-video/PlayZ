import ClientPage from './ClientPage';

// এটি সার্ভার কম্পোনেন্ট, তাই Next.js কোনো এরর ধরবে না
export function generateStaticParams() {
  return []; 
}

export default function Page() {
  return <ClientPage />;
}
