'use client';

// 🎯 ১. ইন্টারফেসসমূহ
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

// 🎯 ২. সার্ভার র‍্যাংকার
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

// 🎯 ৩. নেটওয়ার্ক এআই
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

// app/media/PlayzEngine.ts এর ভেতরে StallDetector ক্লাসটি এরকম করে দিন:

export class StallDetector {
  static check(video: HTMLVideoElement, lastTime: number): boolean {
    // 🎯 ফিক্স: ভিডিও পজ থাকলে অথবা একদম শুরুতে (currentTime === 0) থাকলে স্টল ধরবে না
    if (!video || video.paused || video.currentTime === 0) return false;

    const timeDelta = Math.abs(video.currentTime - lastTime);

    const isTimeFrozen = timeDelta < 0.2;
    const isBuffering = video.readyState < 3;

    return isTimeFrozen || isBuffering;
  }
}


// 🧠 ৫. টার্মিনেটর স্ট্রিম ব্রেইন (আপডেটেড: গ্যারান্টিড সার্ভার সুইচ)
export class StreamBrain {
  private static deadCounter = 0;
  private static lastTime = -1;
  private static lastSwitch = 0;

  // নতুন সার্ভার লোড হলে আগের স্টল ডেটা ক্লিয়ার করার জন্য
  static reset() {
    this.deadCounter = 0;
    this.lastTime = -1;
  }

  static update(ctx: { video: HTMLVideoElement; safeSwitch: () => void; }) {
    const { video, safeSwitch } = ctx;
    const now = Date.now();

    // ইনিশিয়াল সেটআপ
    if (this.lastTime === -1) {
        this.lastTime = video.currentTime;
        return;
    }

    // স্টল চেক
    const stalled = StallDetector.check(video, this.lastTime);
    this.lastTime = video.currentTime;

    if (stalled) {
        this.deadCounter++; // আটকে থাকলে কাউন্টার বাড়বে
    } else {
        this.deadCounter = 0; // ভিডিও ঠিকঠাক চললে কাউন্টার জিরো
    }

    // 🔴 গ্যারান্টিড সার্ভার সুইচ (টানা ৮ সেকেন্ড ডেড থাকলে)
    if (this.deadCounter >= 8) {
        if (now - this.lastSwitch > 12000) { // ১২ সেকেন্ডের অ্যান্টি-লুপ লক
            this.lastSwitch = now;
            this.reset(); // সুইচ করার আগে কাউন্টার ক্লিন করে নেওয়া
            
            // ডেডলক ব্রেকার: সোজা নেক্সট সার্ভার!
            safeSwitch(); 
        }
    }
  }
}
