import type { Metadata } from 'next';
import StreamPlayer from './StreamPlayer';

// 🚀 সোর্স ডাটা ডাইরেক্ট সার্ভার সাইড থেকে রিড করার জন্য এন্টারপ্রাইজ API লিংক
const LIVE_EVENTS_API = process.env.NEXT_PUBLIC_EVENT_API; 

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL as string;
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY;

// 🎯 ১. সোশিয়াল মিডিয়া শেয়ার ফিক্সের জন্য ডাইনামিক মেটাডাটা জেনারেটর
export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  // 🟢 সুন্দর লিংক থেকে আসল আইডিটা কেটে বের করা হচ্ছে
  const realId = id.includes('-') ? id.split('-').pop() : id;

  try {
    // সরাসরি Hugging Face API থেকে ডাটা নিয়ে আসা হচ্ছে (সার্ভার সাইড এসইও)
    const res = await fetch(LIVE_EVENTS_API, { next: { revalidate: 15 } });
    if (!res.ok) throw new Error("Failed to fetch");

    const rawMatches = await res.json();
    if (!rawMatches || !Array.isArray(rawMatches)) throw new Error("Invalid array");

    // আইডি ম্যাচ করে বর্তমান ম্যাচটি খুঁজে বের করা
    const currentMatch = rawMatches.find((item: any) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : "";
      return realId === matchId || id.endsWith(matchId);
    });

    if (!currentMatch || !currentMatch.event) {
      throw new Error("No Event Info Found");
    }

    const e = currentMatch.event;

    const teamA = e.teamAName || 'Team A';
    const teamB = e.teamBName || 'Team B';
    const eventName = e.eventName || 'Live Sports';
    const category = e.category || 'Sports';

    const title = `${teamA} vs ${teamB} Live Stream | ${eventName} - All in One Sports`;
    const description = `Watch ${teamA} vs ${teamB} live streaming in HD. Don't miss the ${eventName} (${category}) match today! Fast, free, and mobile-friendly.`;

    const shareImage =
      e.teamAFlag && e.teamAFlag !== 'null'
        ? `${IMG_PROXY}${encodeURIComponent(e.teamAFlag)}`
        : `${SITE_URL}/og-image.jpg`;

    return {
      metadataBase: new URL(SITE_URL || "https://play-z.vercel.app"),
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

  } catch (error) {
    return {
      title: 'Watch Live Sports HD | All in One Sports',
      description: 'Watch Cricket, Football, WWE, UFC and premium sports events live in HD quality.',
      metadataBase: new URL(SITE_URL || "https://play-z.vercel.app"),
    };
  }
}

// 🎯 ২. গুগল সার্চ ইঞ্জিনের ট্রাস্ট অর্জনের জন্য সম্পূর্ণ Schema (JSON-LD) স্ট্রাকচার
export default async function Page(
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;
  
  // 🟢 সুন্দর লিংক থেকে আসল আইডি ফিল্টার করা হচ্ছে
  const realId = id.includes('-') ? id.split('-').pop() : id;
  let jsonLd = null;

  try {
    const res = await fetch(LIVE_EVENTS_API, { next: { revalidate: 15 } });

    if (res.ok) {
      const rawMatches = await res.json();
      const currentMatch = rawMatches.find((item: any) => {
        const rawEvent = item.event || {};
        const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : "";
        return realId === matchId || id.endsWith(matchId);
      });

      if (currentMatch && currentMatch.event) {
        const e = currentMatch.event;

        // আপনার নতুন ISO ডেট ফরম্যাটের সাথে মিল রেখে স্ট্রাকচার
        const convertToISO = (dStr: string, tStr: string) => {
          if (!dStr || !tStr) return undefined;
          const parts = dStr.split('/');
          if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}T${tStr}Z`;
          return `${dStr}T${tStr}Z`;
        };

        const startDateISO = convertToISO(e.date, e.time);

        jsonLd = {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": `${e.teamAName || 'Team A'} vs ${e.teamBName || 'Team B'}`,
          "sport": e.category || "Sports",
          "description": `${e.eventName || 'Live Event'} Live Streaming HD`,
          "eventStatus": "https://schema.org/EventScheduled",
          "startDate": startDateISO,
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
