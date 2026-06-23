export class BufferManager {
  static getBufferHealthScore(video: HTMLVideoElement, lastTime: number): number {
    const buffered = video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = buffered - video.currentTime;
    const freeze = Math.abs(video.currentTime - lastTime) < 0.01;
    const networkBad = video.readyState < 2;

    let score = 100;
    if (bufferAhead < 2) score -= 30;
    if (bufferAhead < 1) score -= 30;
    if (freeze && !video.paused) score -= 20;
    if (networkBad) score -= 20;

    return score;
  }

  static runAdaptiveInflation(video: HTMLVideoElement, lastTime: number, wrapper: any) {
    const score = this.getBufferHealthScore(video, lastTime);
    
    if (score < 40 && !video.paused) {
      wrapper.safeConfigure({
        streaming: {
          bufferingGoal: 25,
          rebufferingGoal: 10,
          bufferBehind: 40,
        }
      });
    }
  }
}
