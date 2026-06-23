import { EngineHealth } from '../types/media';
import { NetworkManager } from './NetworkManager';

export class BufferManager {
  private static lastTimeMetric = 0;
  private static freezeCounter = 0;

  // 🎯 ফিক্স ৬: playTime বাদ দিয়ে জেনুইন liveLatency এবংcurrentTime মনিটরিং মেকানিজম
  static checkManifestAdvancement(video: HTMLVideoElement, playerInstance: any, loggerRef: any): boolean {
    if (!video || !playerInstance) return true;

    try {
      const stats = playerInstance.getStats();
      const latency = stats?.liveLatency || 0;
      
      if (video.currentTime === this.lastTimeMetric && !video.paused && video.currentTime > 0) {
        this.freezeCounter++;
        // latency যদি অস্বাভাবিক বাড়ে বা ১ সেকেন্ড লুপে ৪ বার টাইমস্ট্যাম্প লক থাকে
        if (this.freezeCounter >= 4 || latency > 25) {
          loggerRef.current?.addLog(`🧩 Manifest Guard: Segment block tracker alert!`, 'error');
          this.freezeCounter = 0;
          return false;
        }
      } else {
        this.freezeCounter = 0;
      }
      this.lastTimeMetric = video.currentTime;
    } catch {}
    return true;
  }

  static getEngineHealthMetrics(video: HTMLVideoElement, playerInstance: any): EngineHealth {
    let fps = 0, droppedFrames = 0, totalFrames = 0;

    if (video && typeof video.getVideoPlaybackQuality === 'function') {
      const q = video.getVideoPlaybackQuality();
      droppedFrames = q.droppedVideoFrames;
      totalFrames = q.totalVideoFrames;
      fps = totalFrames > 0 ? Math.round(totalFrames / (video.currentTime || 1)) % 60 || 50 : 0;
    }

    const buffered = video?.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0;
    const bufferAhead = video ? Math.max(0, buffered - video.currentTime) : 0;
    const latency = playerInstance ? playerInstance.getStats()?.liveLatency || 0 : 0;

    return {
      fps, droppedFrames, totalFrames, bufferAhead, latency,
      estimatedBandwidthMbps: 4.5,
      networkTier: NetworkManager.getNetworkTier(),
      trend: NetworkManager.detectTrend()
    };
  }
}
