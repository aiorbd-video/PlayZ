import type { Metadata } from 'next';
import StreamPlayer from './StreamPlayer';

const SITE_URL = 'https://ratulxlive.vercel.app';
const IMG_PROXY = 'https://img.aiorbd.workers.dev/?url=';

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {

  const { id } = await params;

  try {
    const res = await fetch(
      `${SITE_URL}/api/streams/${id}`,
      {
        cache: 'no-store',
        next: { revalidate: 60 }
      }
    );

    const data = await res.json();
    const match = data?.matchInfo;

    if (!match?.eventInfo) {
      return {
        title: 'Watch Live Sports HD',
        description:
          'Watch Cricket, Football, WWE, UFC and premium sports events live in HD quality.',
      };
    }

    const info = match.eventInfo;

    const teamA = info.teamA || 'Team A';
    const teamB = info.teamB || 'Team B';
    const eventName = info.eventName || 'Live Sports';
    const category = info.eventCat || 'Sports';

    const title =
      `${teamA} vs ${teamB} Live Streaming HD | All in One Sports`;

    const description =
      `Watch ${teamA} vs ${teamB} live streaming in HD quality. ${eventName} live online free.`;

    const shareImage =
      info.teamAFlag &&
      info.teamAFlag !== 'null'
        ? `${IMG_PROXY}${encodeURIComponent(info.teamAFlag)}`
        : `${SITE_URL}/og-image.jpg`;

    return {
      metadataBase: new URL(SITE_URL),

      title,
      description,

      keywords: [
        teamA,
        teamB,
        `${teamA} vs ${teamB}`,
        `${teamA} live`,
        `${teamB} live`,
        eventName,
        category,
        'live sports',
        'live streaming',
        'watch live match',
        'sports hd stream',
        'football live',
        'cricket live',
        'wwe live',
        'ufc live'
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
            alt: `${teamA} vs ${teamB}`
          }
        ]
      },

      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [shareImage],
        creator: '@allinonesports'
      },

      other: {
        'og:image:secure_url': shareImage,
        'og:image:type': 'image/jpeg',
        'og:image:width': '1200',
        'og:image:height': '630'
      }
    };

  } catch {
    return {
      title: 'Watch Live Sports HD',
      description:
        'Watch Cricket, Football, WWE, UFC and premium sports events live in HD quality.'
    };
  }
}

export default async function Page(
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;

  let jsonLd = null;

  try {
    const res = await fetch(
      `${SITE_URL}/api/streams/${id}`,
      { cache: 'no-store' }
    );

    const data = await res.json();
    const info = data?.matchInfo?.eventInfo;

    if (info) {
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": `${info.teamA} vs ${info.teamB}`,
        "sport": info.eventCat || "Sports",
        "description": info.eventName,
        "eventStatus": "https://schema.org/EventScheduled",
        "url": `${SITE_URL}/watch/${id}`,
        "organizer": {
          "@type": "Organization",
          "name": "All in One Sports Web"
        }
      };
    }
  } catch {}

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
        <StreamPlayer id={id} />
      </div>

    </main>
  );
}
