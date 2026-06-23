export class StallDetector {
  private static lastCheckTime = 0;

  static checkIsStalled(video: HTMLVideoElement, lastTime: number): boolean {
    if (!video) return false;

    const now = Date.now();
    if (now - this.lastCheckTime < 1000) return false; // ১ সেকেন্ডের নিচে ফ্রিকোয়েন্সি ফিল্টারিং
    this.lastCheckTime = now;

    const buffered = video.buffered.length > 0 ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = buffered - video.currentTime;
    
    // স্যামসাং টিজেন ও এলজি ওয়েবওএস টিভি ফ্রেন্ডলি জেনুইন হার্ডওয়্যার বাফার ল্যাক চেক
    const networkBad = video.readyState === 0 && video.buffered.length === 0;
    const isBufferActuallyBad = networkBad || (video.readyState < 2 && bufferAhead < 0.45 && video.currentTime > 0);
    
    const isPlaybackFrozen = Math.abs(video.currentTime - lastTime) < 0.001;
    const hasStartedAndStuck = isPlaybackFrozen && !video.paused && video.readyState < 3;

    return isBufferActuallyBad || hasStartedAndStuck;
  }
}
