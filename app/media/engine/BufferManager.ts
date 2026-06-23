export class BufferManager {
  private static inflationActive = false;

  static getBufferHealthScore(video: HTMLVideoElement, lastTime: number): number {
    if (!video) return 100;
    
    const buffered = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = buffered - video.currentTime;
    const freeze = Math.abs(video.currentTime - lastTime) < 0.01;
    const networkBad = video.readyState < 2;

    let score = 100;
    
    if (bufferAhead < 2.5) score -= 30;
    if (bufferAhead < 1.0) score -= 30;
    if (freeze && !video.paused && video.currentTime > 0) score -= 20;
    if (networkBad && video.currentTime > 0) score -= 20;

    return Math.max(0, score);
  }

  static runAdaptiveInflation(video: HTMLVideoElement, lastTime: number, wrapper: any, loggerRef: any) {
    if (!video || !wrapper) return;
    
    const score = this.getBufferHealthScore(video, lastTime);
    
    if (score < 40 && !video.paused && !this.inflationActive) {
      this.inflationActive = true;
      loggerRef.current?.addLog(`🧠 Buffer AI: Jitter protection engaged (${score}/100). Auto-inflating pipeline!`, 'warn');
      wrapper.safeConfigure({
        streaming: {
          bufferingGoal: 25,
          rebufferingGoal: 10,
          bufferBehind: 45,
        }
      });
    } else if (score > 75 && this.inflationActive) {
      this.inflationActive = false;
      loggerRef.current?.addLog(`🧠 Buffer AI: Signal normalized (${score}/100). Returning to Sweet Spot setup.`, 'success');
      wrapper.safeConfigure({
        streaming: {
          bufferingGoal: 20,
          rebufferingGoal: 7,
          bufferBehind: 25,
          liveSyncDuration: 6
        }
      });
    }
  }
}
