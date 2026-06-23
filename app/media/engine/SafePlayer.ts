export class SafeShakaWrapper {
  private player: any;
  public isDestroyed = false;

  constructor(player: any) {
    this.player = player;
  }

  async safeLoad(url: string, mime?: string) {
    if (this.isDestroyed || !this.player) return;
    try {
      await this.player.unload();
      return await this.player.load(url, null, mime);
    } catch (e) {
      console.error("SafePlayer: Unload/Load handled safely ->", e);
      throw e;
    }
  }

  safeConfigure(config: any) {
    if (this.isDestroyed || !this.player) return;
    try {
      this.player.configure(config);
    } catch (e) {
      console.error("SafePlayer: Configure failed ->", e);
    }
  }

  safeDestroy() {
    this.isDestroyed = true;
    try {
      if (this.player) {
        this.player.destroy();
      }
    } catch {} finally {
      this.player = null;
    }
  }
}
