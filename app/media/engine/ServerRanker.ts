import { ServerStat, Stream } from '../types/media';

export class ServerRanker {
  private static statsMap = new Map<string, ServerStat>();
  private static STORAGE_KEY = 'playz_live_engine_v2_stats';

  static {
    this.restore();
  }

  private static save() {
    if (typeof window === 'undefined') return;
    try {
      const obj = Object.fromEntries(this.statsMap.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.error('ServerRanker Storage Persist Error:', e);
    }
  }

  private static restore() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.entries(parsed).forEach(([url, stat]) => {
          this.statsMap.set(url, stat as ServerStat);
        });
      }
    } catch (e) {
      console.error('ServerRanker Storage Restore Failed:', e);
    }
  }

  static initializeStats(streamsList: Stream[]) {
    if (!streamsList) return;
    let modified = false;
    streamsList.forEach((stream) => {
      const url = stream.link.split('|')[0].trim();
      if (!this.statsMap.has(url)) {
        this.statsMap.set(url, {
          url,
          successCount: 1, // Baseline
          failCount: 0,
          stallCount: 0,
          totalLoadTime: 1.0,
          lastUsed: Date.now()
        });
        modified = true;
      }
    });
    if (modified) this.save();
  }

  static getServerScore(url: string): number {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (!s) return 50; // Neutral baseline

    const totalAttempts = s.successCount + s.failCount;
    const successRate = totalAttempts > 0 ? s.successCount / totalAttempts : 1;
    
    // Stability calculation: penalties based on stall counts relative to total actions
    const stabilityRate = Math.max(0, 1 - (s.stallCount / (s.successCount + 1 || 1)));
    
    // Speed calculation: average latency inverted mapping (Assume 5.0 seconds as worst response)
    const avgLoadTime = s.successCount > 0 ? s.totalLoadTime / s.successCount : 1.0;
    const speedRate = Math.max(0, Math.min(1, 1 - (avgLoadTime / 5.0)));

    return (successRate * 60) + (stabilityRate * 30) + (speedRate * 10);
  }

  static recordSuccess(url: string, loadTime: number) {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (s) {
      s.successCount++;
      s.totalLoadTime += loadTime;
      s.lastUsed = Date.now();
      this.save();
    }
  }

  static recordFailure(url: string) {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (s) {
      s.failCount++;
      s.lastUsed = Date.now();
      this.save();
    }
  }

  static recordStall(url: string) {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (s) {
      s.stallCount++;
      this.save();
    }
  }

  // Load Balancer Engine Rotation: Score based routing
  static getBestStreamIndex(streamsList: Stream[], currentIdx: number): number {
    if (!streamsList || streamsList.length <= 1) return currentIdx;
    this.initializeStats(streamsList);

    // Sort index mappings dynamically according to internal runtime mathematical weights
    const mappedWithScores = streamsList.map((stream, idx) => ({
      idx,
      score: this.getServerScore(stream.link)
    }));

    mappedWithScores.sort((a, b) => b.score - a.score);
    return mappedWithScores[0].idx;
  }
}
