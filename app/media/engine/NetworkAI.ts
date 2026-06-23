import { NetworkTier, NetworkTrend } from '../types/media';

export class NetworkAI {
  private static history: number[] = [];

  static push(bw: number) {
    this.history.push(bw);
    if (this.history.length > 6) this.history.shift();
  }

  static trend(): NetworkTrend {
    if (this.history.length < 3) return 'stable';

    const a = this.history[this.history.length - 1];
    const b = this.history[this.history.length - 2];
    const c = this.history[this.history.length - 3];

    // স্পিড যদি টানা ৩ বার কমে যায়
    if (a < b && b < c) return 'collapsing';
    
    // স্পিড যদি টানা ৩ বার বাড়ে
    if (a > b && b > c) return 'improving';
    
    return 'stable';
  }

  static tier(bw: number): NetworkTier {
    // ব্যান্ডউইথকে Mbps এ কনভার্ট করে টিয়ার সেট করা
    const mbps = bw / 1000000; 
    
    if (mbps < 1) return 'very_low';
    if (mbps < 3) return 'low';
    if (mbps < 6) return 'medium';
    if (mbps < 15) return 'high';
    return 'ultra';
  }
}
