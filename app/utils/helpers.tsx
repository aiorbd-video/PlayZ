export const MATCH_API = "https://ratulxadia-playz-cats-event.hf.space/api/events";
export const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

export const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export const getImg = (url: string | undefined | null) => {
  if (!url || url === "null" || url === "Null" || url === "") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

export const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return 'upcoming';
  // Cards.tsx এর সাথে সিঙ্ক করে লোকাল টাইম হিসেবে পার্স করার লজিক
  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  if (currentTime > endTime) return 'recent';
  if (currentTime >= startTime && currentTime <= endTime) return 'live';
  return 'upcoming';
};

export const generateSlug = (teamA?: string, teamB?: string, eventName?: string, id?: string | number) => {
  const tA = teamA || 'team';
  const tB = teamB || 'match';
  const event = eventName || 'live-event';
  const rawString = `${tA}-vs-${tB}-${event}`;
  return `${rawString.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${id || '0'}`;
};

// 🟢 ইমোজির বদলে প্রিমিয়াম ডিজিটাল SVG আইকন গ্লোয়িং ইফেক্ট সহ
export const getCategoryIcon = (cat: string) => {
  const baseClass = "w-7 h-7 md:w-8 md:h-8 transition-transform duration-300";

  if (cat === 'All') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#00E5FF] drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  }

  const lowerCat = cat.toLowerCase();

  if (lowerCat.includes('cricket')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#FF3B30] drop-shadow-[0_0_8px_rgba(255,59,48,0.6)]`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.363 5.652l4.243 4.243-9.193 9.192a2.828 2.828 0 01-4.242-4.242l9.192-9.193z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.536 8.48l4.242 4.243" />
        <circle cx="18.5" cy="5.5" r="2.5" fill="currentColor" />
      </svg>
    );
  }

  if (lowerCat.includes('football')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]`}>
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12l3-2.5m-3 2.5l-3-2.5m3 2.5v4m-3-6.5l-4 1.5m10-1.5l4 1.5M7.5 16.5L4 14m12.5 2.5L20 14" />
      </svg>
    );
  }

  if (lowerCat.includes('wwe') || lowerCat.includes('wrestling') || lowerCat.includes('boxing')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" fill="currentColor" fillOpacity="0.2" />
      </svg>
    );
  }

  if (lowerCat.includes('racing') || lowerCat.includes('formula') || lowerCat.includes('motorsport')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#34C759] drop-shadow-[0_0_8px_rgba(52,199,89,0.6)]`}>
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12v10M4 9l8 3 8-3" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      </svg>
    );
  }

  if (lowerCat.includes('hockey')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#FF9500] drop-shadow-[0_0_8px_rgba(255,149,0,0.6)]`}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 3v13a4 4 0 004 4h4" />
        <circle cx="16" cy="18" r="2.5" fill="currentColor" />
      </svg>
    );
  }

  if (lowerCat.includes('basketball')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#FF6F00] drop-shadow-[0_0_8px_rgba(255,111,0,0.6)]`}>
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4M12 2a10 10 0 000 20M2 12a10 10 0 0020 0" />
      </svg>
    );
  }

  // ডিফল্ট বা অন্যান্য ক্যাটাগরির জন্য Trophy আইকন
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${baseClass} text-[#FFD700] drop-shadow-[0_0_8px_rgba(255,215,0,0.6)]`}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4h14a2 2 0 012 2v2a6 6 0 01-6 6H9a6 6 0 01-6-6V6a2 2 0 012-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14v7m-4 0h8" />
    </svg>
  );
};
