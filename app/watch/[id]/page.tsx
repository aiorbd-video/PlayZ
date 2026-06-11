import StreamPlayer from './StreamPlayer';

// 🟢 সম্পূর্ণ সার্ভার-সাইড মেটাডাটা জেনারেটর (সোশাল শেয়ারিং কার্ডের জন্য)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    const res = await fetch(`https://ratulxlive.vercel.app/api/streams/${id}`, { cache: 'no-store' });
    const data = await res.json();
    const match = data?.matchInfo;

    if (!match) {
      return { title: "Watch Live Sports | All in One Sports Web" };
    }

    const titleText = `${match.eventInfo.teamA} VS ${match.eventInfo.teamB} - Watch Live HD`;
    const descText = `Stream ${match.eventInfo.eventName} live in high quality for free without buffering on All in One Sports Web.`;
    
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

// 🟢 মেইন সার্ভার রেন্ডারার
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StreamPlayer id={id} />;
}
