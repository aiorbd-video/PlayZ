import ClientPage from './ClientPage';

export function generateStaticParams() {
  return [];
}

// Next.js থেকে আসা params বা ডেটাগুলো props হিসেবে রিসিভ করা হচ্ছে
export default function Page(props: any) {
  // সেই ডেটাগুলো সরাসরি ClientPage-এ পাঠিয়ে দেওয়া হচ্ছে
  return <ClientPage {...props} />;
}
