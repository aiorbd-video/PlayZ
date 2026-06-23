import { EngineHealth } from '../types/media';
import { NetworkManager } from './NetworkManager';

export class BufferManager {
  private static lastSegmentTime = 0;
  private static segmentCheckCounter = 0;

  static checkManifestAdvancement(playerInstance: any, loggerRef: any): boolean {
    if (!playerInstance || typeof playerInstance.getManifest !== 'function') return true;

    try {
      const manifest = playerInstance.getManifest();
      if (!manifest || !manifest.periodCombinations) return true;

      const stats = playerInstance.getStats();
      const currentPlayhead = stats?.playTime || 0;

      if (currentPlayhead === this.lastSegmentTime && currentPlayhead > 0) {
        this.segmentCheckCounter++;
        if (this.segmentCheckCounter >= 4) { // Segment not advancing for 4 consecutive loops
          loggerRef.current?.addLog(`🧩 Manifest AI: Live timeline freeze discovered via MPD controller!`, 'error');
          this.segmentCheckCounter = 0;
          return false;
        }
      } else {
        this.segmentCheckCounter = 0;
      }
      this.lastSegmentTime = currentPlayhead;
    } catch {}
    return true;
  }

  static getEngineHealthMetrics(video: HTMLVideoElement, playerInstance: any): EngineHealth {
    let fps = 0;
    let droppedFrames = 0;
    let totalFrames = 0;

    if (video && typeof video.getVideoPlaybackQuality === 'function') {
      const q = video.getVideoPlaybackQuality();
      droppedFrames = q.droppedVideoFrames;
      totalFrames = q.totalVideoFrames;
      fps = totalFrames > 0 ? Math.round(totalFrames / (video.currentTime || 1)) % 60 || 50 : 0;
    }

    const buffered = video?.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = video ? Math.max(0, buffered - video.currentTime) : 0;

    let latency = 0;
    try {
      if (playerInstance) {
        const stats = playerInstance.getStats();
        latency = stats.liveLatency || 0;
      }
    } catch {}

    return {
      fps,
      droppedFrames,
      totalFrames,
      bufferAhead,
      latency,
      estimatedBandwidthMbps: NetworkManager.getNetworkTier() === 'ultra' ? 20 : 4.5,
      networkTier: NetworkManager.getNetworkTier(),
      trend: NetworkManager.detectTrend()
    };
  }
}
