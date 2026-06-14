import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.ratulxlive.duckdns.org';

  try {
    // API থেকে একদম ফ্রেশ ডাটা ফেচ করা
    const res = await fetch(`${baseUrl}/api/proxy-matches`, {
      cache: 'no-store',
    });
    
    if (!res.ok) throw new Error('Failed to fetch matches');
    
    const matches = await res.json();
    const currentTime = new Date();

    // প্রতিটা ম্যাচের স্ট্যাটাস চেক করে সাইটম্যাপ রুলস সেট করা
    const matchUrls = matches.map((match: any) => {
      const startStr = match.eventInfo?.startTime;
      const endStr = match.eventInfo?.endTime;

      let status = 'upcoming'; // ডিফল্ট স্ট্যাটাস

      if (startStr && endStr) {
        // টাইম ফরম্যাট ফিক্স করা
        const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
        const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
        
        if (currentTime > endTime) {
          status = 'ended';
        } else if (currentTime >= startTime && currentTime <= endTime) {
          status = 'live';
        }
      }

      // 🎯 স্ট্যাটাস অনুযায়ী এসইও (SEO) প্রায়োরিটি সেট করা
      let changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never' = 'daily';
      let priority = 0.7;

      if (status === 'live') {
        // লাইভ ম্যাচ: গুগলকে বলবে বারবার চেক করতে এবং প্রায়োরিটি সবচেয়ে বেশি
        changeFrequency = 'always';
        priority = 0.9;
      } else if (status === 'upcoming') {
        // আপকামিং ম্যাচ: গুগলকে বলবে প্রতি ঘণ্টায় চেক করতে
        changeFrequency = 'hourly';
        priority = 0.8;
      } else if (status === 'ended') {
        // এন্ডেড ম্যাচ: গুগলকে বলবে এটা আর চেঞ্জ হবে না, প্রায়োরিটি কম
        changeFrequency = 'never';
        priority = 0.5;
      }

      return {
        url: `${baseUrl}/watch/${match.id}`,
        lastModified: new Date(),
        changeFrequency: changeFrequency,
        priority: priority,
      };
    });

    // মেইন হোমপেজ সবসময় টপ প্রায়োরিটি (1.0) পাবে
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'always',
        priority: 1.0,
      },
      ...matchUrls,
    ];
  } catch (error) {
    // API ডাউন থাকলে শুধু হোমপেজ রিটার্ন করবে
    return [
      {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'always',
        priority: 1.0,
      },
    ];
  }
}
