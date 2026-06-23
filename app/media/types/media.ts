export interface Stream {
  title?: string;
  link: string;
  api?: string;
  logo?: string;
  category?: string;
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

  // performance metrics
  successCount: number;
  failCount: number;
  stallCount: number;

  totalLoadTime: number;
  lastUsed: number;

  // optional AI extensions
  avgLoadTime?: number;
  reliabilityScore?: number;
  healthScore?: number;

  // runtime flags
  lastErrorCode?: number;
  consecutiveFailures?: number;
}

export interface EngineHealth {
  fps: number;
  droppedFrames: number;
  totalFrames: number;

  bufferAhead: number;
  latency: number;

  estimatedBandwidthMbps: number;

  networkTier: NetworkTier;
  trend: NetworkTrend;

  qoeScore?: number;
}

export type PlaybackState =
  | 'stable'
  | 'degrading'
  | 'unstable'
  | 'critical'
  | 'recovering';

export type NetworkTier =
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'ultra';

export type NetworkTrend =
  | 'stable'
  | 'collapsing'
  | 'improving';

export type RecoveryLevel =
  | 'none'
  | 'micro_seek'
  | 'force_play'
  | 'reload'
  | 'failover';
