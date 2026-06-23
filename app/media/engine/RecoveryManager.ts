// 🟢 এটি একদম নিশ্চিতভাবে কাজ করবে:
import { PlayerLogsHandle } from '@/app/components/PlayerLogs';


export class RecoveryManager {
  private static lastSwitchTimestamp = 0;

  static handleLayeredRecovery(
    stallCount: number,
    video: HTMLVideoElement | null,
    playerInstance: any,
    wrapper: any,
    loggerRef: React.RefObject<PlayerLogsHandle | null>,
    safeSwitchServer: () => void
  ) {
    if (!video || !playerInstance) return;

    // 🎯 ফিক্স ৩: লাইভ আইপিটিভির জন্য প্রগ্রেসিভ থ্রেশহোল্ড ভিত্তিক রিল্যাক্সড রিকভারি
    if (stallCount >= 3 && stallCount < 6) {
      loggerRef.current?.addLog(`⚡ Recovery L1 (Stall: ${stallCount}): Micro-seek (+0.01s) execute.`, 'warn');
      video.currentTime += 0.01;
      video.play().catch(() => {});
    } 
    else if (stallCount >= 6 && stallCount < 10) {
      loggerRef.current?.addLog(`⚡ Recovery L2 (Stall: ${stallCount}): Force play pipeline signal.`, 'warn');
      video.play().catch(() => {});
    } 
    else if (stallCount >= 10 && stallCount < 15) {
      loggerRef.current?.addLog(`⚡ Recovery L3 (Stall: ${stallCount}): Manifest level reloading via Shaka.`, 'warn');
      try {
        playerInstance.retryStreaming();
      } catch {
        video.load();
      }
    } 
    else if (stallCount >= 15) {
      // 🎯 ফিক্স ৮: এন্টি-লুপ সুইচ গার্ড (৮ সেকেন্ড সিকিউরিটি লক)
      const now = Date.now();
      if (now - this.lastSwitchTimestamp < 8000) {
        loggerRef.current?.addLog("🛡️ Shield Guard: Blocked rapid loop server bouncing.", "warn");
        return;
      }
      this.lastSwitchTimestamp = now;
      loggerRef.current?.addLog(`⚡ Recovery L4 (Stall: ${stallCount}): Failover triggered. Mutating stream channel...`, 'error');
      safeSwitchServer();
    }
  }
}
