export class SafeShakaWrapper {
  public player: any;
  public isDestroyed = false;
  private activeListeners: { element: any; event: string; handler: any }[] = [];

  constructor(player: any) {
    this.player = player;
  }

  async safeLoad(url: string, mime?: string) {
    if (this.isDestroyed || !this.player) {
      throw new Error("SafePlayer Instance is dead.");
    }
    try {
      await this.player.unload();
      return await this.player.load(url, null, mime);
    } catch (e) {
      console.error("SafePlayer Load Error:", e);
      throw e;
    }
  }

  safeConfigure(config: any) {
    if (this.isDestroyed || !this.player) return;
    try {
      this.player.configure(config);
    } catch (e) {
      console.error("SafePlayer Config Error:", e);
    }
  }

  // 🎯 ফিক্স ৫: মেমোরি লিক আটকাতে ইভেন্ট লিসেনার সেফ ম্যানেজার
  safeAddEventListener(target: any, event: string, handler: any) {
    if (this.isDestroyed || !target) return;
    try {
      target.addEventListener(event, handler);
      this.activeListeners.push({ element: target, event, handler });
    } catch (e) {
      console.error(`SafePlayer Event Binding Failed: ${event}`, e);
    }
  }

  private clearAllListeners() {
    this.activeListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch {}
    });
    this.activeListeners = [];
  }

  safeDestroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.clearAllListeners();
    
    try {
      if (this.player) {
        this.player.destroy();
      }
    } catch {} finally {
      this.player = null;
    }
  }
}
