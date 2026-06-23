import { ServerStat, Stream } from '../types/media';

export class ServerRanker {
  private static statsMap = new Map<string, ServerStat>();

  static initializeStats(streamsList: Stream[]) {
    if (!streamsList) return;
    streamsList.forEach((stream) => {
      const url = stream.link.split('|')[0].trim();
      if (!this.statsMap.has(url)) {
        this.statsMap.set(url, {
          url,
          failCount: 0,
          successCount: 1, // বেসলাইন স্ট্যাবিলিটি ১ দিয়ে শুরু
          avgLoadTime: 1.0, // ১ সেকেন্ডের ডিফল্ট বাফার লোড টাইম
          stallCount: 0,
        });
      }
    });
  }

  static getServerScore(url: string): number {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl) || {
      url: cleanUrl,
      failCount: 0,
      successCount: 1,
      avgLoadTime: 1.0,
      stallCount: 0,
    };

    return (
      s.successCount * 10 -
      s.failCount * 20 -
      s.stallCount * 5 -
      s.avgLoadTime * 0.5
    );
  }

  static recordSuccess(url: string, loadTime: number) {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (s) {
      s.successCount++;
      // Exponential moving average দিয়ে লেটেস্ট স্পিড ট্র্যাক করা
      s.avgLoadTime = (s.avgLoadTime * 0.7) + (loadTime * 0.3);
    }
  }

  static recordFailure(url: string) {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (s) {
      s.failCount++;
    }
  }

  static recordStall(url: string) {
    const cleanUrl = url.split('|')[0].trim();
    const s = this.statsMap.get(cleanUrl);
    if (s) {
      s.stallCount++;
    }
  }

  static rankStreams(streamsList: Stream[]): Stream[] {
    this.initializeStats(streamsList);
    return [...streamsList].sort((a, b) => {
      const scoreA = this.getServerScore(a.link);
      const scoreB = this.getServerScore(b.link);
      return scoreB - scoreA;
    });
  }

  static getBestStreamIndex(streamsList: Stream[], currentIdx: number): number {
    if (!streamsList || streamsList.length <= 1) return currentIdx;
    const ranked = this.rankStreams(streamsList);
    const foundIndex = streamsList.findIndex(s => s.link === ranked[0].link);
    return foundIndex !== -1 ? foundIndex : currentIdx;
  }
}
