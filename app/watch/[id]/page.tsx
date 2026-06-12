import StreamPlayer from './StreamPlayer';

// 🟢 মেটাডাটা লজিক একই থাকছে
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const res = await fetch(`https://ratulxlive.vercel.app/api/streams/${id}`, { cache: 'no-store' });
    const data = await res.json();
    const match = data?.matchInfo;

    if (!match) return { title: "Watch Live Sports | All in One Sports Web" };

    const titleText = `${match.eventInfo.teamA} VS ${match.eventInfo.teamB} - Watch Live HD`;
    const descText = `Stream ${match.eventInfo.eventName} live in high quality for free on All in One Sports Web.`;
    
    const shareImage = match.eventInfo.teamAFlag && match.eventInfo.teamAFlag !== "null" 
      ? `https://img.aiorbd.workers.dev/?url=${encodeURIComponent(match.eventInfo.teamAFlag)}`
      : "https://ratulxlive.vercel.app/favicon.ico";

    return {
      title: titleText,
      description: descText,
      openGraph: {
        title: titleText,
        description: descText,
        url: `https://ratulxlive.vercel.app/watch/${id}`,
        siteName: 'All in One Sports Web',
        images: [{ url: shareImage, width: 800, height: 800 }],
        type: 'video.other',
      },
      twitter: {
        card: 'summary_large_image',
        title: titleText,
        description: descText,
        images: [shareImage],
      }
    };
  } catch {
    return { title: "Watch Live Sports | All in One Sports Web" };
  }
}

// 🟢 রেন্ডারার সেকশন আপডেট করা হয়েছে যাতে ব্যাকগ্রাউন্ড থিম বজায় থাকে
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#11131A] text-white">
      {/* 
        এখানে StreamPlayer কম্পোনেন্টটি আপনার অরিজিনাল স্ট্রিমিং লজিক ধরে রাখবে।
        এই পেজটি এখন ব্যাকগ্রাউন্ড কালার হিসেবে #11131A সেট করে দিলো, 
        যা আপনার হোমপেজের থিমের সাথে একদম ম্যাচ করবে।
      */}
      <div className="max-w-7xl mx-auto">
        <StreamPlayer id={id} />
      </div>
    </main>
  );
}
