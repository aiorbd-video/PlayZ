import { MetadataRoute } from 'next';

// 🟢 মেইন পেজের মতো হুবহু SEO ফ্রেন্ডলি স্লাগ জেনারেটর
const generateSlug = (teamA?: string, teamB?: string, eventName?: string, id?: string | number) => {
  const tA = teamA || 'team';
  const tB = teamB || 'match';
  const event = eventName || 'live-event';
  const rawString = `${tA}-vs-${tB}-${event}`;
  return `${rawString.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${id || '0'}`;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // আপনার মেইন ডোমেইন (Environment Variable থাকলে সেটা নেবে, নাহলে ডিফল্ট)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ratulxlive.duckdns.org';

  // মেইন হোমপেজ সবসময় টপ প্রায়োরিটি (1.0) পাবে
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1.0,
    },
  ];

  try {
    // 🚀 সমান্তরালভাবে (Parallel) ৩টি API থেকে ডাটা ফেচ করা হচ্ছে (যাতে বিল্ড সুপারফাস্ট হয়)
    const [matchesRes, channelsRes, m3uRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/proxy-matches`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/channels`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/m3u`, { cache: 'no-store' })
    ]);

    const currentTime = new Date();

    // ==========================================
    // ১. Matches (Live Events) প্রসেসিং
    // ==========================================
    if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
      const matches = await matchesRes.value.json();
      
      matches.forEach((match: any) => {
        const eventInfo = match.eventInfo || {};
        const startStr = eventInfo.startTime;
        const endStr = eventInfo.endTime;

        let status = 'upcoming';

        if (startStr && endStr) {
          const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
          const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
          
          if (currentTime > endTime) status = 'ended';
          else if (currentTime >= startTime && currentTime <= endTime) status = 'live';
        }

        let changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never' = 'hourly';
        let priority = 0.8;

        if (status === 'live') {
          changeFrequency = 'always';
          priority = 0.9;
        } else if (status === 'ended') {
          changeFrequency = 'never';
          priority = 0.5;
        }

        // 🎯 SEO ফ্রেন্ডলি ইউআরএল সেট করা হচ্ছে
        const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

        routes.push({
          url: `${baseUrl}/watch/${slugLink}`,
          lastModified: new Date(),
          changeFrequency: changeFrequency,
          priority: priority,
        });
      });
    }

    // ==========================================
    // ২. Sports (Custom Channels) প্রসেসিং
    // ==========================================
    if (channelsRes.status === 'fulfilled' && channelsRes.value.ok) {
      const channelData = await channelsRes.value.json();
      const channels = channelData?.channels || [];
      
      channels.forEach((channel: any) => {
        routes.push({
          url: `${baseUrl}/tv/${channel.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.8, // টিভি চ্যানেলগুলোর ভ্যালু বেশি, তাই 0.8
        });
      });
    }

    // ==========================================
    // ৩. Categories (M3U Playlists) প্রসেসিং
    // ==========================================
    if (m3uRes.status === 'fulfilled' && m3uRes.value.ok) {
      const m3uData = await m3uRes.value.json();
      const playlists = m3uData?.channels || [];
      
      playlists.forEach((playlist: any) => {
        routes.push({
          url: `${baseUrl}/playlist/${playlist.id}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7, // প্লেলিস্টের প্রায়োরিটি স্পোর্টসের চেয়ে একটু কম
        });
      });
    }

  } catch (error) {
    console.error("Sitemap generation error:", error);
    // কোনো বড় এরর হলে শুধু হোমপেজ রিটার্ন করবে
  }

  return routes;
}
