import ClientPage from './ClientPage';

// ১. Next.js কে শান্ত করতে একটি ডামি (dummy) আইডি দিয়ে দিলাম
export async function generateStaticParams() {
  return [{ id: '1' }]; 
}

// ২. আপনার আসল পেজে ডেটা পাঠিয়ে দিলাম
export default function Page(props: any) {
  return <ClientPage {...props} />;
}
