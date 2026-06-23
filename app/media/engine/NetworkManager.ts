export class NetworkManager {
  private static lastKnownTier: 'low' | 'medium' | 'high' = 'medium';

  static getNetworkTier(playerInstance: any): 'low' | 'medium' | 'high' {
    if (!playerInstance || typeof playerInstance.getStats !== 'function') {
      return this.lastKnownTier;
    }
    
    try {
      const stats = playerInstance.getStats();
      const bandwidthBps = stats.estimatedBandwidth; 
      
      if (!bandwidthBps || isNaN(bandwidthBps)) {
        // Smart TV স্পেশাল ফলব্যাক ওএস চেক
        if (typeof navigator !== 'undefined' && (navigator as any).connection) {
          const down = (navigator as any).connection.downlink;
          if (down) {
            if (down < 1.2) return 'low';
            if (down < 3.5) return 'medium';
            return 'high';
          }
        }
        return this.lastKnownTier;
      }

      const downlinkMbps = bandwidthBps / 1000000;
      
      if (downlinkMbps < 1.5) this.lastKnownTier = 'low';
      else if (downlinkMbps < 4.5) this.lastKnownTier = 'medium';
      else this.lastKnownTier = 'high';
      
      return this.lastKnownTier;
    } catch {
      return this.lastKnownTier;
    }
  }

  static applyFakeABR(wrapper: any, playerInstance: any, loggerRef: any) {
    if (!wrapper || !playerInstance) return;
    
    const tier = this.getNetworkTier(playerInstance);
    const currentConfig = playerInstance.getConfiguration();
    const currentGoal = currentConfig?.streaming?.bufferingGoal;

    // বারংবার কনফিগ রিলোড পুশ এড়াতে শুধুমাত্র স্টেট চেঞ্জ হলেই কনফিগ ওভাররাইড হবে
    if (tier === 'low' && currentGoal !== 30) {
      loggerRef.current?.addLog(`📡 Network AI: Poor signal. Shifting profile to Safe-Buffer Mode.`, 'warn');
      wrapper.safeConfigure({
        streaming: { bufferingGoal: 30, rebufferingGoal: 15, liveSyncDuration: 8 }
      });
    } else if (tier === 'medium' && currentGoal !== 20) {
      wrapper.safeConfigure({
        streaming: { bufferingGoal: 20, rebufferingGoal: 7, liveSyncDuration: 6 }
      });
    } else if (tier === 'high' && currentGoal !== 12) {
      wrapper.safeConfigure({
        streaming: { bufferingGoal: 12, rebufferingGoal: 5, liveSyncDuration: 4 }
      });
    }
  }
}
