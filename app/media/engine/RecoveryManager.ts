import { PlayerLogsHandle } from '../../components/PlayerLogs';

export class RecoveryManager {
  private static lastRecoveryTimestamp = 0;
  private static totalConsecutiveFailures = 0;

  static handleFatalError(
    loggerRef: React.RefObject<PlayerLogsHandle | null>, 
    safeSwitchServer: () => void,
    wrapper: any
  ) {
    const now = Date.now();
    this.totalConsecutiveFailures++;

    // একই সেকেন্ডে ডাবল বা ট্রিপল রিকার্সিভ লুপ বাস্ট প্রটেকশন
    if (now - this.lastRecoveryTimestamp < 4000) {
      loggerRef.current?.addLog("🛡️ Recovery: Cascade lock active. Suppressing rapid recursive swaps.", "warn");
      return;
    }
    
    this.lastRecoveryTimestamp = now;
    loggerRef.current?.addLog(`🛡️ Shield Engine: Fatal crash caught [#${this.totalConsecutiveFailures}]. Auto-recovering player instance...`, "error");
    
    safeSwitchServer();

    // শাকা প্লেয়ার ড্রপ করার পর সাইলেন্টলি ডিআরএম ফ্ল্যাশ রিবুট
    setTimeout(() => {
      try {
        if (wrapper && !wrapper.isDestroyed) {
          wrapper.safeConfigure({ drm: { clearKeys: {} } });
        }
      } catch (e) {
        console.error("Recovery Manager: DRM purge failed silsently ->", e);
      }
    }, 1200);
  }

  static resetFailureTracker() {
    this.totalConsecutiveFailures = 0;
  }
}
