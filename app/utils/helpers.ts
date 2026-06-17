export const MATCH_API = "/api/proxy-matches";
export const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

export const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((res) => res.json());

export const getImg = (url: string | undefined | null) => {
  if (!url || url === "null" || url === "Null" || url === "") return "/fallback-logo.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

export const getMatchStatus = (startStr: string, endStr: string, currentTime: Date) => {
  if (!startStr || !endStr) return 'upcoming';
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

export const getCategoryIcon = (cat: string) => {
  if (cat === 'All') return "🎧";
  const lowerCat = cat.toLowerCase();
  if (lowerCat.includes('cricket')) return "🏏";
  if (lowerCat.includes('football')) return "⚽";
  if (lowerCat.includes('wwe') || lowerCat.includes('wrestling')) return "🤼";
  if (lowerCat.includes('racing') || lowerCat.includes('formula')) return "🏎️";
  if (lowerCat.includes('hockey')) return "🏑";
  if (lowerCat.includes('basketball')) return "🏀";
  return "🏆";
};
