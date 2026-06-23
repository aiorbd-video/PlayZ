export class StallDetector {
  static checkIsStalled(video: HTMLVideoElement, lastTime: number): boolean {
    const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = buffered - video.currentTime;
    
    const networkBad = video.readyState === 0 && video.buffered.length === 0;
    const isBufferActuallyBad = networkBad || (video.readyState < 2 && bufferAhead < 0.5 && video.currentTime > 0);
    const isPlaybackFrozen = Math.abs(video.currentTime - lastTime) < 0.001;

    return isBufferActuallyBad || (isPlaybackFrozen && !video.paused && video.readyState < 3);
  }
}
