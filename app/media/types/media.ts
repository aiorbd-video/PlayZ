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
  failCount: number;
  successCount: number;
  avgLoadTime: number;
  stallCount: number;
  score?: number;
}
