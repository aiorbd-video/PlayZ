import type { Metadata } from 'next';
import StreamPlayer from './StreamPlayer';

const API_URL = process.env.API_URL;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL as string;
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY;

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  // 🟢 সুন্দর লিংক থেকে আসল আইডিটা কেটে বের করা হচ্ছে
  const realId = id.includes('-') ? id.split('-').pop() : id;

  try {
    // 🟢 ফিক্স: API_URL এর বদলে SITE_URL ব্যবহার করা হলো, কারণ /api/streams রাউটটি Vercel-এর নিজের ভেতরেই আছে
    const res = await fetch(
      `${SITE_URL}/api/streams/${realId}`,
      {
        cache: 'no-store',
        next: { revalidate: 60 }
      }
    );

    if (!res.ok) throw new Error("Failed to fetch");

    const data = await res.json();
    const match = data?.matchInfo;

    if (!match?.eventInfo) {
      throw new Error("No Event Info");
    }

    const info = match.eventInfo;

    const teamA = info.teamA || 'Team A';
    const teamB = info.teamB || 'Team B';
    const eventName = info.eventName || 'Live Sports';
    const category = info.eventCat || 'Sports';

    const title = `${teamA} vs ${teamB} Live Stream | ${eventName} - All in One Sports`;
    const description = `Watch ${teamA} vs ${teamB} live streaming in HD. Don't miss the ${eventName} (${category}) match today! Fast, free, and mobile-friendly.`;

    const shareImage =
      info.teamAFlag && info.teamAFlag !== 'null'
        ? `${IMG_PROXY}${encodeURIComponent(info.teamAFlag)}`
        : `${SITE_URL}/og-image.jpg`;

    return {
      metadataBase: new URL(SITE_URL || "https://www.ratulxlive.duckdns.org"),
      title,
      description,
      keywords: [
        teamA,
        teamB,
        `${teamA} vs ${teamB}`,
        `${teamA} live`,
        `${teamB} live stream`,
        eventName,
        category,
        'live sports hd',
        'watch free sports',
        'live streaming'
      ],
      alternates: {
        canonical: `${SITE_URL}/watch/${id}`
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1
        }
      },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/watch/${id}`,
        siteName: 'All in One Sports Web',
        locale: 'en_US',
        type: 'website',
        images: [
          {
            url: shareImage,
            width: 1200,
            height: 630,
            alt: `${teamA} vs ${teamB} Live`
          }
        ]
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [shareImage],
        creator: '@allinonesports'
      }
    };

  } catch {
    return {
      title: 'Watch Live Sports HD | All in One Sports',
      description: 'Watch Cricket, Football, WWE, UFC and premium sports events live in HD quality.',
      metadataBase: new URL(SITE_URL || "https://www.ratulxlive.duckdns.org"),
    };
  }
}

export default async function Page(
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;
  
  // 🟢 সুন্দর লিংক থেকে আসল আইডি ফিল্টার করা হচ্ছে
  const realId = id.includes('-') ? id.split('-').pop() : id;
  let jsonLd = null;

  try {
    // 🟢 ফিক্স: এখানেও ইন্টারনাল এপিআই রিকোয়েস্ট সাকসেস করার জন্য SITE_URL ব্যবহার করা হলো
    const res = await fetch(
      `${SITE_URL}/api/streams/${realId}`,
      { cache: 'no-store' }
    );

    if (res.ok) {
      const data = await res.json();
      const info = data?.matchInfo?.eventInfo;

      if (info) {
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": `${info.teamA} vs ${info.teamB}`,
          "sport": info.eventCat || "Sports",
          "description": `${info.eventName} Live Streaming HD`,
          "eventStatus": "https://schema.org/EventScheduled",
          "startDate": info.startTime ? new Date(info.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')).toISOString() : undefined,
          "url": `${SITE_URL}/watch/${id}`,
          "organizer": {
            "@type": "Organization",
            "name": "All in One Sports Web",
            "url": SITE_URL
          }
        };
      }
    }
  } catch (error) {
    console.error("SEO Data Fetch Error:", error);
  }

  return (
    <main className="min-h-screen bg-[#11131A] text-white">

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd)
          }}
        />
      )}

      <div className="max-w-7xl mx-auto">
        {/* 🟢 StreamPlayer-কে আসল আইডি দেওয়া হলো যাতে প্লেয়ার ইন্টারনাল লজিক ও সাইডবার ঠিকঠাক ট্র্যাক করতে পারে */}
        <StreamPlayer id={realId as string} />
      </div>

    </main>
  );
}
