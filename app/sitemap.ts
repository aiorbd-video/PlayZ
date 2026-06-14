import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.ratulxlive.duckdns.org';

  try {
    // আপনার API থেকে রানিং ম্যাচগুলোর ডাটা ফেচ করা
    // cache: 'no-store' দেওয়া হয়েছে যাতে গুগল সবসময় ফ্রেশ লাইভ ম্যাচের লিংক পায়
    const res = await fetch(`${baseUrl}/api/proxy-matches`, {
      cache: 'no-store',
    });
    
    if (!res.ok) throw new Error('Failed to fetch matches');
    
    const matches = await res.json();

    // প্রতিটা ম্যাচের জন্য আলাদা আলাদা /watch/id লিংক তৈরি করা
    const matchUrls = matches.map((match: any) => ({
      url: `${baseUrl}/watch/${match.id}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    }));

    // মেইন হোমপেজ এবং লাইভ ম্যাচের পেজগুলো একসাথে রিটার্ন করা
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'always' as const,
        priority: 1.0,
      },
      ...matchUrls,
    ];
  } catch (error) {
    // যদি কোনো কারণে API ফেইল করে, গুগলকে অন্তত মেইন হোমপেজটা দিয়ে দেবে
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'always' as const,
        priority: 1.0,
      },
    ];
  }
}
