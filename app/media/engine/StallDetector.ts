import { Stream, ServerStat, PlaybackState, NetworkTier, EngineHealth } from '../types/media';

export class StallDetector {
  static checkIsStalled(video: HTMLVideoElement, lastTime: number): boolean {
    if (!video) return false;

    const buffered =
      video.buffered.length > 0
        ? video.buffered.end(video.buffered.length - 1)
        : 0;

    // DASH/MPD এজ কেস গ্লিচ রুখতে ১০ সেকেন্ডের সেফটি বাফার ক্ল্যাম্প
    const bufferAhead = Math.max(0, Math.min(buffered - video.currentTime, 10));

    const currentBufferThreshold = bufferAhead > 2 ? 0.15 : 0.45;

    const timeDelta = Math.abs(video.currentTime - lastTime);

    // টাইম-বেসড অ্যাডাপ্টিভ ফ্রিজ ডিটেকশন (টিভি ও পিসির জিটার হ্যান্ডেলার)
    const isFrozen =
      video.currentTime > 0 &&
      (
        (video.readyState < 3 && timeDelta < 0.015) ||
        (video.readyState >= 3 && timeDelta < 0.005)
      );

    const isStarving =
      video.readyState < 2 &&
      bufferAhead < currentBufferThreshold &&
      !video.paused;

    let framesFrozen = false;

    try {
      if (typeof video.getVideoPlaybackQuality === 'function') {
        const q = video.getVideoPlaybackQuality();

        const dropRatio =
          q.totalVideoFrames > 0
            ? q.droppedVideoFrames / q.totalVideoFrames
            : 0;

        // সিঙ্গল স্ন্যাপশট ফলস অ্যালার্ম রুখতে জেনুইন ব্যাড ডিকোড ট্র্যাকিং
        framesFrozen =
          dropRatio > 0.35 &&
          bufferAhead < currentBufferThreshold &&
          video.readyState < 3;
      }
    } catch {}

    return (
      (
        isFrozen &&
        !video.paused &&
        video.currentTime > 0 &&
        bufferAhead < 0.30
      ) ||
      isStarving ||
      framesFrozen
    );
  }
}
