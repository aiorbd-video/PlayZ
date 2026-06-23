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
}

export interface EngineHealth {
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  bufferAhead: number;
  latency: number;
  estimatedBandwidthMbps: number;
  networkTier: 'very_low' | 'low' | 'medium' | 'high' | 'ultra';
  trend: 'stable' | 'collapsing' | 'improving';
}
