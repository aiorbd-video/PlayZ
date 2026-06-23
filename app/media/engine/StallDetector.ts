export interface Stream {
  title?: string;
  link: string;
  api?: string;
}

export interface EventInfo {
  eventCat: string;
  eventName: string;
  teamA: string;
  teamB: string;
  startTime: string;
  endTime: string;
  link_names?: string[];
}

export interface Match {
  id: number | string;
  eventInfo: EventInfo;
  links?: string;
}

export interface ServerStat {
  url: string;
  successCount: number;
  failCount: number;
  stallCount: number;
  totalLoadTime: number;
  lastUsed: number;
  
  // 🎯 ফিক্স ১: ফিউচার ইঞ্জিন ইভোলিউশন ও স্পিড ইনডেক্স ট্র্যাক করার জন্য অপশনাল ফিল্ড
  avgLoadTime?: number;
}

// 🎯 ফিক্স ২: রিকভারি চলাকালীন ডাবল লুপ ক্ল্যাশ বা স্প্যামিং রুখতে 'recovering' স্টেট যুক্ত করা হলো
export type PlaybackState = 'stable' | 'degrading' | 'unstable' | 'critical' | 'recovering';
