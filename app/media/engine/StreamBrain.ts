import { StallDetector } from './StallDetector';
import { QoEEngine } from './QoEEngine';

export class StreamBrain {
  private static stallCount = 0;
  private static lastTime = 0;
  private static lastSwitch = 0;
  private static microSeekCooldown = 0;

  static update(ctx: {
    video: HTMLVideoElement;
    buffer: number;
    drop: number;
    latency: number;
    safeSwitch: () => void;
  }) {
    const { video, buffer, drop, latency, safeSwitch } = ctx;
    const now = Date.now();

    // ইনিশিয়াল প্লেব্যাক বা বড় সিকিংয়ের সময় ফলস অ্যালার্ম বন্ধ করা
    if (this.lastTime === 0 || Math.abs(video.currentTime - this.lastTime) > 5) {
      this.lastTime = video.currentTime;
      return;
    }

    // স্টল ডিটেক্টর থেকে সিগন্যাল নেওয়া
    const stalled = StallDetector.checkIsStalled(video, this.lastTime);
    this.lastTime = video.currentTime;

    if (stalled) {
      this.stallCount++;
    } else {
      this.stallCount = Math.max(0, this.stallCount - 1);
    }

    // QoE স্কোর ক্যালকুলেট করা
    const qoe = QoEEngine.score({ 
      stall: this.stallCount, 
      buffer, 
      drop, 
      latency, 
      rebuffer: 0 
    });

    // 🟢 Stable Zone (সব ঠিক আছে)
    if (qoe > 75) return;

    // 🟡 Degrade Zone (হালকা ল্যাগ, মাইক্রো-সিক দিয়ে ধাক্কা দেওয়া হবে)
    if (qoe > 50) {
      if (now - this.microSeekCooldown > 3000) {
        this.microSeekCooldown = now;
        video.currentTime += 0.01;
        video.play().catch(() => {});
      }
      return;
    }

    // 🟠 Unstable Zone (ফোর্স প্লে কমান্ড দেওয়া হবে)
    if (qoe > 25) {
      video.play().catch(() => {});
      return;
    }

    // 🔴 Critical Zone (সার্ভার চেঞ্জ করা হবে)
    if (now - this.lastSwitch > 12000) {
      this.lastSwitch = now;
      this.stallCount = 0; // সার্ভার সুইচের আগে স্টল কাউন্ট রিসেট
      safeSwitch();
    }
  }
}
