export class StallDetector {
  private static lastCheckedTime = 0;
  private static lastFrameCount = 0;

  static checkIsStalled(video: HTMLVideoElement, lastTime: number, playerInstance: any): boolean {
    if (!video) return false;

    const now = Date.now();
    if (now - this.lastCheckedTime < 1000) return false; // Throttled at 1 second core intervals
    this.lastCheckedTime = now;

    const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = buffered - video.currentTime;

    // Check frame dropping metrics using raw HTML5 Media Engine
    let framesStuck = false;
    if (typeof video.getVideoPlaybackQuality === 'function') {
      const q = video.getVideoPlaybackQuality();
      if (q && q.totalVideoFrames === this.lastFrameCount && !video.paused && video.currentTime > 0) {
        framesStuck = true;
      }
      if (q) this.lastFrameCount = q.totalVideoFrames;
    }

    const isFrozen = Math.abs(video.currentTime - lastTime) < 0.01;
    const isStarving = video.readyState < 2 && bufferAhead < 0.4 && !video.paused;

    return (isFrozen && !video.paused && video.currentTime > 0) || isStarving || framesStuck;
  }
}
