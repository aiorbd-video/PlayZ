''''use client';

import { useState, useEffect, useMemo, memo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const MATCH_API = "/api/proxy-matches";
const IMG_PROXY = process.env.NEXT_PUBLIC_IMG_PROXY || "https://img.aiorbd.workers.dev/?url=";

// --- SVG Icons ---
const Icon = ({ path, className = "w-6 h-6" }: { path: string; className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const Icons = {
  Menu: () => <Icon path="M4 6h16M4 12h16M4 18h16" />,
  Share: () => <Icon path="M15 8a4 4 0 00-4.633-3.916 4.002 4.002 0 00-4.24 5.333A4.002 4.002 0 006 17a4 4 0 004-4 4 4 0 00.833-2.37" />, 
  Heart: () => <Icon path="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.667l1.318-1.35a4.5 4.5 0 016.364 6.364L12 20.333l-7.682-7.651a4.5 4.5 0 010-6.364z" />,
  Refresh: () => <Icon path="M4 4v5h5M20 20v-5h-5M4 4a14.95 14.95 0 0114.65 11.2M20 20a14.95 14.95 0 01-14.65-11.2" />,
  Search: () => <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
  Close: () => <Icon path="M6 18L18 6M6 6l12 12" />,
  Check: () => <Icon path="M5 13l4 4L19 7" className="w-4 h-4" />,
  Sports: () => <Icon path="M13 10.25a.75.75 0 00-1.06-.04l-3 2.5a.75.75 0 001.12 1.08L12 12.2v6.55a.75.75 0 001.5 0v-8.5z M12 21a9 9 0 100-18 9 9 0 000 18zm0-1.5a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" className="w-7 h-7" />, 
  LiveEvents: () => (
    <div className="relative flex items-center justify-center w-7 h-7">
      <span className="absolute text-2xl font-bold opacity-80">(</span>
      <span className="absolute text-2xl font-bold opacity-80">)</span>
      <span className="absolute text-xs font-extrabold opacity-90">.</span>
    </div>
  ),
  Categories: () => <Icon path="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 14a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" className="w-7 h-7" />
};


interface EventInfo {
  eventCat?: string;
  eventName?: string;
  eventLogo?: string;
  teamA?: string;
  teamB?: string;
  teamAFlag?: string;
  teamBFlag?: string;
  startTime?: string;
  endTime?: string;
}

interface Match {
  id: string | number;
  eventInfo?: EventInfo;
}

const fetcher = (url: string): Promise<Match[]> => fetch(url, { cache: 'no-store' }).then((res) => res.json());

const getImg = (url: string) => {
  if (!url || url === "null") return "https://img.icons8.com/color/48/000000/shield.png";
  return `${IMG_PROXY}${encodeURIComponent(url)}`;
};

const getMatchStatus = (startStr: string | undefined, endStr: string | undefined, currentTime: Date) => {
  if (!startStr || !endStr) return 'upcoming';
  const startTime = new Date(startStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const endTime = new Date(endStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  if (currentTime > endTime) return 'recent';
  if (currentTime >= startTime && currentTime <= endTime) return 'live';
  return 'upcoming';
};

const LiveTimer = memo(({ startTimeStr }: { startTimeStr: string | undefined }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startTimeStr) return null;
  const startTime = new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  let diffMs = time.getTime() - startTime.getTime();
  if (diffMs < 0) diffMs = 0;

  const h = String(Math.floor(diffMs / 3600000)).padStart(2, '0');
  const m = String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0');
  
  if(h === '00') return <span className="font-mono text-xs tracking-tighter">{m}:{s}</span>

  return <span className="font-mono text-xs tracking-tighter">{h}:{m}:{s}</span>;
});
LiveTimer.displayName = 'LiveTimer';

const UpcomingTimer = memo(({ startTimeStr }: { startTimeStr: string | undefined }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000 * 60);
    return () => clearInterval(timer);
  }, []);
  
  if (!startTimeStr) return null;
  const startTime = new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z'));
  const diffMs = startTime.getTime() - time.getTime();

  if (diffMs <= 0) return <span className="font-semibold text-sm">Starting Soon</span>;

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return <span className="font-semibold text-sm">Match Starting in {diffHours} Hours {diffMinutes} Mins</span>
});
UpcomingTimer.displayName = 'UpcomingTimer';


const getCategoryIcon = (cat: string) => {
    if (!cat) return <Image src="https://img.icons8.com/fluency/48/trophy.png" alt="trophy" width={36} height={36} unoptimized />;
    const lowerCat = cat.toLowerCase();
    if (lowerCat.includes('cricket')) return <Image src="https://img.icons8.com/color/48/cricket.png" alt="cricket" width={36} height={36} unoptimized />;
    if (lowerCat.includes('football')) return <Image src="https://img.icons8.com/color/48/football2.png" alt="football" width={36} height={36} unoptimized />;
    if (lowerCat.includes('wwe')) return <Image src="https://img.icons8.com/color/48/wrestling.png" alt="wwe" width={36} height={36} unoptimized />;
    if (lowerCat.includes('racing')) return <Image src="https://img.icons8.com/color/48/f1-race-car-top-view.png" alt="racing" width={36} height={36} unoptimized />;
    if (lowerCat.includes('hockey')) return <Image src="https://img.icons8.com/color/48/ice-hockey.png" alt="hockey" width={36} height={36} unoptimized />;
    if (lowerCat.includes('basketball')) return <Image src="https://img.icons8.com/color/48/basketball.png" alt="basketball" width={36} height={36} unoptimized />;
    if (lowerCat.includes('tennis')) return <Image src="https://img.icons8.com/color/48/tennis.png" alt="tennis" width={36} height={36} unoptimized />;
    if (lowerCat.includes('all')) return <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center"><Icon path="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" className="w-6 h-6 text-background" /></div>;
    return <Image src="https://img.icons8.com/fluency/48/trophy.png" alt="trophy" width={36} height={36} unoptimized />;
};

const MatchCard = memo(({ match, status }: { match: Match; status: string }) => {
  const eventInfo = match.eventInfo || {};
  const startTime = eventInfo.startTime ? new Date(eventInfo.startTime.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')) : null;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Link href={`/watch/${match.id}`} className="outline-none group block" prefetch={false}>
        <div className="bg-card-background rounded-2xl p-4 border-t border-accent/40 shadow-xl shadow-black/20 transition-all duration-300 group-hover:brightness-110 group-focus:ring-2 group-focus:ring-accent">
          
          <div className="flex items-center gap-2 mb-4">
            {eventInfo.eventLogo && <Image src={getImg(eventInfo.eventLogo)} alt="" width={16} height={16} className="object-contain" unoptimized />}
            <span className="text-xs font-semibold text-text-secondary truncate">{eventInfo.eventCat} | {eventInfo.eventName}</span>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="flex flex-col items-center gap-2 w-[28%]">
              <Image src={getImg(eventInfo.teamAFlag!)} alt={eventInfo.teamA || 'Team A'} width={40} height={40} className="object-contain rounded-full" unoptimized />
              <span className="font-semibold text-sm text-center truncate w-full">{eventInfo.teamA}</span>
            </div>

            <div className="w-[44%] flex flex-col items-center justify-center">
              {status === 'live' ? (
                <div className="flex flex-col items-center">
                   <span className="text-text-live text-xs font-bold animate-pulse">Live</span>
                   <LiveTimer startTimeStr={eventInfo.startTime} />
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <span className="font-bold text-sm">{startTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                  <span className="font-semibold text-xs text-text-secondary">{startTime?.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 w-[28%]">
              <Image src={getImg(eventInfo.teamBFlag!)} alt={eventInfo.teamB || 'Team B'} width={40} height={40} className="object-contain rounded-full" unoptimized />
              <span className="font-semibold text-sm text-center truncate w-full">{eventInfo.teamB}</span>
            </div>
          </div>

          {status === 'upcoming' && (
            <div className="text-center bg-background/50 rounded-lg py-1.5 px-3 mt-2 text-text-secondary">
              <UpcomingTimer startTimeStr={eventInfo.startTime} />
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
});
MatchCard.displayName = 'MatchCard';

function MatchSkeleton() {
  return (
    <div className="bg-card-background rounded-2xl p-4 border-t border-accent/20 animate-pulse">
      <div className="h-4 bg-pill-bg/50 rounded w-2/3 mb-4"></div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col items-center gap-2 w-[28%]">
          <div className="w-10 h-10 rounded-full bg-pill-bg/50"></div>
          <div className="h-3 bg-pill-bg/50 rounded w-full"></div>
        </div>
        <div className="w-[44%] h-6 bg-pill-bg/50 rounded"></div>
        <div className="flex flex-col items-center gap-2 w-[28%]">
          <div className="w-10 h-10 rounded-full bg-pill-bg/50"></div>
          <div className="h-3 bg-pill-bg/50 rounded w-full"></div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFilter, setActiveFilter] = useState('All');
  const { data: matches, error, mutate } = useSWR<Match[]>(MATCH_API, fetcher, { refreshInterval: 30000 });

  const counts = useMemo(() => {
    if (!matches) return { all: 0, live: 0, recent: 0, upcoming: 0 };
    const now = new Date();
    return matches.reduce((acc, m) => {
      const status = getMatchStatus(m.eventInfo?.startTime, m.eventInfo?.endTime, now);
      acc.all++;
      if(status === 'live') acc.live++;
      if(status === 'recent') acc.recent++;
      if(status === 'upcoming') acc.upcoming++;
      return acc;
    }, { all: 0, live: 0, recent: 0, upcoming: 0 });
  }, [matches]);

  const dynamicCategories = useMemo(() => {
    const list = ['All', 'Cricket', 'Football', 'WWE', 'Racing', 'Hockey', 'Basketball', 'Tennis'];
    if (matches && Array.isArray(matches)) {
      const uniqueCats = new Set(matches.map(m => m.eventInfo?.eventCat).filter(Boolean));
      uniqueCats.forEach(cat => {
        if (!list.find(c => c.toLowerCase() === cat!.toLowerCase())) {
          list.push(cat as string);
        }
      });
    }
    return list.slice(0, 10); // Limit categories for UI
  }, [matches]);

  const filters = ['All', 'Live', 'Recent', 'Upcoming'];

  const processedMatches = useMemo(() => {
    if (!matches) return [];
    const now = new Date();
    return [...matches].filter(match => {
      if (activeCategory !== 'All' && match.eventInfo?.eventCat !== activeCategory) return false;
      const status = getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, now);
      if (activeFilter === 'Live' && status !== 'live') return false;
      if (activeFilter === 'Recent' && status !== 'recent') return false;
      if (activeFilter === 'Upcoming' && status !== 'upcoming') return false;
      return true;
    }).sort((a, b) => {
        const aStatus = getMatchStatus(a.eventInfo?.startTime, a.eventInfo?.endTime, new Date());
        const bStatus = getMatchStatus(b.eventInfo?.startTime, b.eventInfo?.endTime, new Date());
        const priority = { live: 1, upcoming: 2, recent: 3 };
        if (priority[aStatus] !== priority[bStatus]) return priority[aStatus] - priority[bStatus];
        const aStart = new Date(a.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
        const bStart = new Date(b.eventInfo?.startTime?.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z') || 0).getTime();
        if (aStatus === 'upcoming') return aStart - bStart;
        if (aStatus === 'recent') return bStart - aStart;
        return aStart - bStart;
    });
  }, [matches, activeCategory, activeFilter]);

  return (
    <main className="min-h-screen font-sans pb-28">
      <header className="p-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md flex items-center justify-between">
        <button className="p-2"><Icons.Menu /></button>
        <h1 className="text-xl font-bold">GHD Sports</h1>
        <div className="flex items-center gap-1">
          <button className="p-2"><Icons.Share /></button>
          <button className="p-2"><Icons.Heart /></button>
          <button className="p-2" onClick={() => mutate()}><Icons.Refresh /></button>
          <button className="p-2"><Icons.Search /></button>
        </div>
      </header>

      <div className="px-4 mt-2">
        <div className="flex items-center justify-start gap-3 py-2 mb-2 overflow-x-auto scrollbar-hide snap-x">
          {dynamicCategories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className="flex flex-col items-center gap-2 cursor-pointer group min-w-[65px] snap-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${activeCategory === cat ? 'bg-card-background scale-110' : 'bg-transparent'}`}>
                {getCategoryIcon(cat)}
              </div>
              <span className={`text-xs font-semibold transition-colors ${activeCategory === cat ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>{cat}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-6 py-1 snap-x">
          {filters.map(filter => {
            const count = counts[filter.toLowerCase() as keyof typeof counts];
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all snap-center flex items-center gap-2 ${isActive ? "bg-pill-bg text-text-primary border border-accent/50" : "bg-pill-bg/60 text-text-secondary"}`}>
                {isActive && <Icons.Check />}
                {filter} ({count})
              </button>
            );
          })}
        </div>

        {error && <div className="text-center py-10 text-red-400">Failed to load matches. Please try again.</div>}
        {!matches && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <MatchSkeleton key={i} />)}
          </div>
        )}

        <AnimatePresence>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedMatches.map(match => {
              const status = getMatchStatus(match.eventInfo?.startTime, match.eventInfo?.endTime, new Date());
              return <MatchCard key={match.id} match={match} status={status} />;
            })}
          </div>
        </AnimatePresence>

        {matches && processedMatches.length === 0 && (
            <div className="text-center py-12 text-text-secondary">No matches found.</div>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-bottom-nav-bg/90 backdrop-blur-lg border-t border-accent/20 flex justify-around items-center py-2">
        <button className="flex flex-col items-center gap-1 text-text-secondary">
          <Icons.Sports />
          <span className="text-xs">Sports</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-accent -mt-4">
          <div className="w-16 h-16 rounded-full bg-bottom-nav-bg border-4 border-accent/30 flex items-center justify-center">
            <Icons.LiveEvents />
          </div>
          <span className="text-xs font-bold">Live Events</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-text-secondary">
          <Icons.Categories />
          <span className="text-xs">Categories</span>
        </button>
      </footer>
    </main>
  );
}
''''