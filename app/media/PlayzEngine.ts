'use client';

export interface Stream {
  title?: string;
  link: string;
  api?: string;
}

export interface ServerStat {
  url: string;
  successCount: number;
  failCount: number;
  stallCount: number;
  totalLoadTime: number;
  lastUsed: number;
  avgLoadTime?: number;
}

export class ServerRanker {
  private static stats = new Map<string, ServerStat>();

  static getScore(url: string): number {
    const s = this.stats.get(url);
    if (!s) return 50;
    const total = s.successCount + s.failCount;
    const successRate = total ? s.successCount / total : 1;
    const stability = 1 - s.stallCount / (s.successCount + 1);
    const avgTime = s.successCount > 0 ? s.totalLoadTime / s.successCount : 1.0;
    const speed = Math.max(0, 1 - avgTime / 5);
    return successRate * 60 + stability * 25 + speed * 15;
  }

  static recordSuccess(url: string, t: number) {
    const s = this.stats.get(url) || {
      url, successCount: 0, failCount: 0, stallCount: 0, totalLoadTime: 0, lastUsed: Date.now(),
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

export class NetworkAI {
  private static history: number[] = [];
  static push(bw: number) {
    this.history.push(bw);
    if (this.history.length > 6) this.history.shift();
  }
  static trend(): 'stable' | 'down' | 'up' {
    if (this.history.length < 3) return 'stable';
    const a = this.history[this.history.length - 1];
    const b = this.history[this.history.length - 2];
    const c = this.history[this.history.length - 3];
    if (a < b && b < c) return 'down';
    if (a > b && b > c) return 'up';
    return 'stable';
  }
}

// 🎯 ফিক্সড: স্টল ডিটেক্টর (এখন ০ সেকেন্ডেও কাজ করবে)
export class StallDetector {
  static check(video: HTMLVideoElement, lastTime: number): boolean {
    if (!video || video.paused) return false;

    const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = Math.max(0, buffered - video.currentTime);
    const timeDelta = Math.abs(video.currentTime - lastTime);

    // ভিডিও প্লে করা আছে কিন্তু টাইম এগোচ্ছে না এবং বাফার কম
    return timeDelta < 0.01 && bufferAhead < 0.5;
  }
}

export class QoEEngine {
  static score(data: { stall: number; buffer: number; drop: number; latency: number; rebuffer: number; }) {
    let qoe = 100;
    qoe -= data.stall * 10;
    if (data.buffer < 1) qoe -= (1 - data.buffer) * 25;
    qoe -= data.drop * 40;
    qoe -= data.latency > 10 ? (data.latency - 10) * 2 : 0;
    qoe -= data.rebuffer * 15;
    return Math.max(0, Math.min(100, qoe));
  }
}

// 🎯 ফিক্সড: স্ট্রিম ব্রেইন (লাফালাফি বন্ধ এবং সঠিক সময়ে সার্ভার সুইচ)
export class StreamBrain {
  private static stallCount = 0;
  private static lastTime = 0;
  private static lastSwitch = 0;
  private static startupStall = 0;

  static update(ctx: { video: HTMLVideoElement; buffer: number; drop: number; latency: number; safeSwitch: () => void; }) {
    const { video, buffer, drop, latency, safeSwitch } = ctx;
    const now = Date.now();

    // 🎯 ভিডিও শুরুতেই আটকে থাকলে ১২ সেকেন্ড পর সার্ভার চেঞ্জ করবে
    if (video.currentTime === 0 && !video.paused) {
       this.startupStall++;
       if (this.startupStall > 12) { 
           this.startupStall = 0;
           this.lastSwitch = now;
           safeSwitch();
       }
       return; 
    } else {
       this.startupStall = 0; 
    }

    const stalled = StallDetector.check(video, this.lastTime);
    this.lastTime = video.currentTime;

    if (stalled) this.stallCount++;
    else this.stallCount = Math.max(0, this.stallCount - 1);

    const qoe = QoEEngine.score({ stall: this.stallCount, buffer, drop, latency, rebuffer: 0 });

    if (qoe > 75) return;

    if (qoe > 35) {
      // 🎯 লাফালাফি (micro-seek) বাদ দিয়ে শুধু নরমাল প্লে কমান্ড দেওয়া হলো
      if (video.paused) video.play().catch(() => {});
      return; 
    }

    // 🎯 মারাত্মক ল্যাগ হলে সার্ভার চেঞ্জ করবে (ডেডলক রিমুভড)
    if (now - this.lastSwitch > 8000) { 
      this.lastSwitch = now;
      this.stallCount = 0;
      safeSwitch();
    }
  }
}
