'use client';

import { useState, useEffect, memo } from 'react';
import Image from 'next/image';
import Link from 'next/link'; // 🎯 ব্রাউজার ডিফল্ট a ট্যাগ বাদ দিয়ে আবার Next.js Link আনা হলো
import { motion } from 'framer-motion';
import { getImg, generateSlug, IMG_PROXY } from '../utils/helpers';

export const SmartImage = memo(({ src, alt, fill, width, height, className }: any) => {
  const originalSrc = (!src || src === "null" || src === "Null" || src === "") ? "/fallback-logo.png" : src;
  const [imgSrc, setImgSrc] = useState(originalSrc);
  const [errorCount, setErrorCount] = useState(0);

  const imageProps = fill ? { fill: true } : { width: width || 80, height: height || 80 };

  return (
    <Image
      src={imgSrc}
      alt={alt || "Logo"}
      className={className}
      unoptimized
      onError={() => {
        if (errorCount === 0 && originalSrc !== "/fallback-logo.png") {
          setErrorCount(1);
          setImgSrc(`${IMG_PROXY}${encodeURIComponent(originalSrc)}`);
        } else {
          setImgSrc("/fallback-logo.png");
        }
      }}
      {...imageProps}
    />
  );
});
SmartImage.displayName = 'SmartImage';

export const MatchCountdown = memo(({ startTimeStr, endTimeStr, status }: { startTimeStr: string, endTimeStr: string, status: string }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startTime = startTimeStr ? new Date(startTimeStr.replace(/\//g, '-').replace(' ', 'T').replace(' +0000', 'Z')) : null;

  if (status === 'recent') {
    return <div className="text-gray-400 text-xs font-bold uppercase mt-2">Match Ended</div>;
  }

  if (status === 'live' && startTime) {
    const elapsedMs = time.getTime() - startTime.getTime();
    const elapsedSecs = Math.max(0, Math.floor(elapsedMs / 1000));
    const h = Math.floor(elapsedSecs / 3600);
    const m = Math.floor((elapsedSecs % 3600) / 60);
    const s = elapsedSecs % 60;
    const elapsedStr = `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg md:text-xl animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">((•))</span>
        <span className="text-red-500 text-[10px] md:text-xs font-bold tracking-wide uppercase">Live</span>
        <span className="text-[#00E5FF] text-[10px] md:text-xs font-mono font-bold bg-[#00E5FF]/10 px-2 py-0.5 rounded shadow-inner tracking-widest">{elapsedStr}</span>
      </div>
    );
  } else if (status === 'live') {
    return (
      <div className="flex flex-col items-center justify-center gap-1">
        <span className="text-red-500 text-lg md:text-xl animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">((•))</span>
        <span className="text-red-500 text-[10px] md:text-xs font-bold tracking-wide uppercase">Live</span>
      </div>
    );
  }

  if (!startTime) return <span className="text-gray-400 font-bold text-xs">TBA</span>;
  
  const diffMs = startTime.getTime() - time.getTime();
  if (diffMs <= 0) return <span className="text-green-500 font-bold text-xs animate-pulse">Starting...</span>;
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);

  const timeStr = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startTime.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); 

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="text-gray-200 text-sm md:text-base font-bold tracking-wide">{timeStr}</div>
      <div className="text-[#00E5FF] text-[10px] md:text-xs font-bold mt-0.5">{dateStr}</div>
      
      {diffHours < 1 ? (
        <div className="text-amber-400 text-[11px] md:text-xs mt-2 font-bold whitespace-nowrap bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse font-mono tracking-wider">
           In {diffMins.toString().padStart(2, '0')}m {diffSecs.toString().padStart(2, '0')}s
        </div>
      ) : (
        <div className="text-gray-300 text-[10px] md:text-xs mt-2 font-semibold">
           Starting in {diffHours}h {diffMins}m
        </div>
      )}
    </div>
  );
});
MatchCountdown.displayName = 'MatchCountdown';

export const ChannelCard = memo(({ channel, isPlaylist }: { channel: any, isPlaylist?: boolean }) => {
  const secureId = isPlaylist ? channel.id : btoa(unescape(encodeURIComponent(channel.id)));
  const linkHref = isPlaylist ? `/playlist?id=${secureId}` : `/tv?id=${secureId}`;

  return (
    <motion.div whileTap={{ scale: 0.95 }} className="w-full">
      {/* 🎯 a ট্যাগের বদলে Link ব্যবহার করা হলো যাতে পেজ রিফ্রেশ না হয় */}
      <Link href={linkHref} className="outline-none block h-full">
        <div className="bg-[#1C1E2B] border border-[#2A8496]/50 rounded-xl p-2 md:p-3 flex flex-col items-center justify-center aspect-[4/5] hover:border-[#00E5FF] hover:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all relative overflow-hidden group">
          <div className="w-[50px] h-[50px] md:w-[70px] md:h-[70px] lg:w-[80px] lg:h-[80px] rounded-full bg-white flex items-center justify-center overflow-hidden mb-2 shadow-inner border border-gray-300 transition-transform group-hover:scale-110">
            <SmartImage src={channel.logo} alt={channel.name} width={80} height={80} className="object-contain p-1" />
          </div>
          
          <div className="w-full overflow-hidden whitespace-nowrap text-center main-marquee-container mt-1">
            <span className={`inline-block font-semibold text-[10px] sm:text-xs md:text-sm text-gray-200 group-hover:text-white ${channel.name.length > 11 ? 'main-marquee-text' : ''}`}>
              {channel.name}
            </span>
          </div>
        </div>
      </Link>

      <style dangerouslySetInnerHTML={{__html: `
        .main-marquee-container {
           mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
           -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
        }
        .main-marquee-text {
           padding-left: 100%;
           animation: home-card-marquee 6s linear infinite;
        }
        @keyframes home-card-marquee {
           0% { transform: translateX(0); }
           100% { transform: translateX(-100%); }
        }
      `}} />
    </motion.div>
  );
});
ChannelCard.displayName = 'ChannelCard';

export const MatchCard = memo(({ match, status }: { match: any; status: string }) => {
  const eventInfo = match.eventInfo || match.event || {};
  const slugLink = generateSlug(eventInfo.teamA, eventInfo.teamB, eventInfo.eventName, match.id);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }} className="h-full">
      {/* 🎯 a ট্যাগের বদলে Link ব্যবহার করা হলো যাতে পেজ রিফ্রেশ না হয় */}
      <Link href={`/watch?id=${slugLink}`} className="outline-none block h-full mb-3 md:mb-0">
        <div className="bg-[#1C1E2B] border border-[#2A8496]/70 rounded-[16px] p-4 transition-all hover:border-[#00E5FF] hover:shadow-[0_4px_20px_rgba(0,229,255,0.15)] h-full flex flex-col justify-between">
          
          {(eventInfo.eventCat || eventInfo.eventName) && (
            <div className="flex items-center justify-center gap-2 mb-4 border-b border-gray-800/60 pb-3">
              {eventInfo.eventLogo && eventInfo.eventLogo !== "null" && (
                <div className="relative w-5 h-5 bg-white rounded-full overflow-hidden flex-shrink-0">
                  <SmartImage src={eventInfo.eventLogo} alt="Logo" fill className="object-contain p-0.5" />
                </div>
              )}
              <span className="text-xs md:text-sm text-gray-300 font-semibold truncate max-w-[85%] uppercase tracking-wide">
                {[eventInfo.eventCat, eventInfo.eventName].filter(Boolean).join(' | ')}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center px-1 md:px-3 mt-auto">
            <div className="flex flex-col items-center gap-1.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full bg-white overflow-hidden border-2 border-gray-400/50 shadow-sm">
                <SmartImage src={eventInfo.teamAFlag} alt={eventInfo.teamA || 'Team A'} fill className="object-cover" />
              </div>
              <span className="font-bold text-[11px] md:text-sm text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamA || 'Team A'}</span>
            </div>

            <div className="w-[40%] flex flex-col justify-center items-center">
              <MatchCountdown startTimeStr={eventInfo.startTime} endTimeStr={eventInfo.endTime} status={status} />
            </div>

            <div className="flex flex-col items-center gap-1.5 w-[30%]">
              <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full bg-white overflow-hidden border-2 border-gray-400/50 shadow-sm">
                <SmartImage src={eventInfo.teamBFlag} alt={eventInfo.teamB || 'Team B'} fill className="object-cover" />
              </div>
              <span className="font-bold text-[11px] md:text-sm text-gray-200 truncate w-full text-center mt-1">{eventInfo.teamB || 'Team B'}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}, (prevProps, nextProps) => prevProps.match.id === nextProps.match.id && prevProps.status === nextProps.status);
MatchCard.displayName = 'MatchCard';
