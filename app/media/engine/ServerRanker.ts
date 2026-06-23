import { Stream, ServerStat } from '../types/media';

export class ServerRanker {
  private static stats = new Map<string, ServerStat>();

  static getScore(url: string): number {
    const s = this.stats.get(url);
    if (!s) return 50;

    const total = s.successCount + s.failCount;
    const successRate = total ? s.successCount / total : 1;

    const stability = 1 - s.stallCount / (s.successCount + 1);
    
    // লোড টাইম মাইনাসে যেন না যায় তার জন্য সেফটি ক্ল্যাম্প
    const avgTime = s.successCount > 0 ? s.totalLoadTime / s.successCount : 1.0;
    const speed = Math.max(0, 1 - avgTime / 5);

    return successRate * 60 + stability * 25 + speed * 15;
  }

  static recordSuccess(url: string, t: number) {
    const s = this.stats.get(url) || {
      url,
      successCount: 0,
      failCount: 0,
      stallCount: 0,
      totalLoadTime: 0,
      lastUsed: Date.now(),
    };

    s.successCount++;
    s.totalLoadTime += t;
    s.lastUsed = Date.now();

    this.stats.set(url, s);
  }

  static recordFailure(url: string) {
    const s = this.stats.get(url);
    if (!s) return;

    s.failCount++;
    s.lastUsed = Date.now();
  }

  static recordStall(url: string) {
    const s = this.stats.get(url);
    if (!s) return;

    s.stallCount++;
  }

  static pickBest(streams: Stream[]): number {
    let best = 0;
    let bestScore = -Infinity;

    streams.forEach((s, i) => {
      const score = this.getScore(s.link);
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });

    return best;
  }
}
