import { PlayerLogsHandle } from '../../../components/PlayerLogs';

export class RecoveryManager {
  private static recoveryStageMap = new Map<string, number>();
  private static lockTimestamp = 0;

  static handleLayeredRecovery(
    url: string,
    video: HTMLVideoElement | null,
    playerInstance: any,
    wrapper: any,
    loggerRef: React.RefObject<PlayerLogsHandle | null>,
    safeSwitchServer: () => void
  ) {
    if (!url || !playerInstance || !video) return;
    const now = Date.now();
    
    if (now - this.lockTimestamp < 3000) return; // Prevent loop stampede
    this.lockTimestamp = now;

    const cleanUrl = url.split('|')[0].trim();
    const currentStage = this.recoveryStageMap.get(cleanUrl) || 0;

    if (currentStage === 0) {
      loggerRef.current?.addLog(`⚡ Recovery L1: Micro-seek (+0.01s) triggered to push pipeline decoder.`, 'warn');
      video.currentTime += 0.01;
      video.play().catch(() => {});
      this.recoveryStageMap.set(cleanUrl, 1);
    } 
    else if (currentStage === 1) {
      loggerRef.current?.addLog(`⚡ Recovery L2: Playback pipeline execution sequence forced.`, 'warn');
      video.play().catch(() => {});
      this.recoveryStageMap.set(cleanUrl, 2);
    } 
    else if (currentStage === 2) {
      loggerRef.current?.addLog(`⚡ Recovery L3: Resetting internal streaming mechanics via Shaka runtime.`, 'warn');
      try {
        playerInstance.retryStreaming();
      } catch {
        video.load();
      }
      this.recoveryStageMap.set(cleanUrl, 3);
    } 
    else {
      loggerRef.current?.addLog(`⚡ Recovery L4: Soft measures exhausted. Initiating server sequence mutation.`, 'error');
      this.recoveryStageMap.set(cleanUrl, 0);
      safeSwitchServer();
    }
  }

  static clearTracker(url: string) {
    this.recoveryStageMap.delete(url.split('|')[0].trim());
  }
}
