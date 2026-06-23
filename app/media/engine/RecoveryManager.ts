import { PlayerLogsHandle } from '../../components/PlayerLogs';

export class RecoveryManager {
  static handleFatalError(loggerRef: React.RefObject<PlayerLogsHandle | null>, safeSwitchServer: () => void) {
    loggerRef.current?.addLog("🛡️ Shield Engine: Smart recovery triggered. Swapping stream channel...", "error");
    safeSwitchServer();
  }
}
