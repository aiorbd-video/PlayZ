import type { Metadata } from 'next';
import StreamPlayer from './StreamPlayer';

const LIVE_EVENTS_API = process.env.NEXT_PUBLIC_LIVE_EVENTS_API as string;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL as string;
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY;

// 🎯 Optimization: Centralized Cached Fetcher with Edge Revalidation Tag
async function getCachedMatches() {
  if (!LIVE_EVENTS_API) return [];
  try {
    const res = await fetch(LIVE_EVENTS_API, {
      next: { 
        revalidate: 15, // Edge cached for 15s (Stale-while-revalidate)
        tags: ['live-events'] 
      }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const realId = id.includes('-') ? id.split('-').pop() : id;

  try {
    const rawMatches = await getCachedMatches();
    const currentMatch = rawMatches.find((item: any) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : "";
      return realId === matchId || id.endsWith(matchId);
    });

    if (!currentMatch?.event) throw new Error();
    const e = currentMatch.event;

    const title = `${e.teamAName || 'Team A'} vs ${e.teamBName || 'Team B'} Live Stream | ${e.eventName || 'Live Sports'}`;
    const description = `Watch ${e.teamAName || 'Team A'} vs ${e.teamBName || 'Team B'} live streaming in HD. Free and fast mobile streaming.`;
    const shareImage = e.teamAFlag && e.teamAFlag !== 'null' ? `${IMG_PROXY}${encodeURIComponent(e.teamAFlag)}` : `${SITE_URL}/og-image.jpg`;

    return {
      metadataBase: new URL(SITE_URL || "https://play-z.vercel.app"),
      title, description,
      alternates: { canonical: `${SITE_URL}/watch/${id}` },
      openGraph: { title, description, url: `${SITE_URL}/watch/${id}`, images: [{ url: shareImage }] },
      twitter: { card: 'summary_large_image', title, description, images: [shareImage] }
    };
  } catch (error) {
    return { title: 'Watch Live Sports HD | All in One Sports' };
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const realId = id.includes('-') ? id.split('-').pop() : id;
  let jsonLd = null;

  try {
    const rawMatches = await getCachedMatches();
    const currentMatch = rawMatches.find((item: any) => {
      const rawEvent = item.event || {};
      const matchId = rawEvent.links ? rawEvent.links.replace("pro/", "").replace(".txt", "") : "";
      return realId === matchId || id.endsWith(matchId);
    });

    if (currentMatch?.event) {
      const e = currentMatch.event;
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        "name": `${e.teamAName || 'Team A'} vs ${e.teamBName || 'Team B'}`,
        "sport": e.category || "Sports",
        "url": `${SITE_URL}/watch/${id}`
      };
    }
  } catch (e) {}

  return (
    <main className="min-h-screen bg-[#11131A] text-white">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <div className="max-w-7xl mx-auto">
        <StreamPlayer key={realId} id={realId as string} />
      </div>
    </main>
  );
}
