export class NetworkManager {
  static getNetworkTier(playerInstance: any): 'low' | 'medium' | 'high' {
    if (!playerInstance || typeof playerInstance.getStats !== 'function') return 'medium';
    
    try {
      const stats = playerInstance.getStats();
      const bandwidthBps = stats.estimatedBandwidth; 
      if (!bandwidthBps) return 'medium';

      const downlinkMbps = bandwidthBps / 1000000;
      if (downlinkMbps < 1.5) return 'low';
      if (downlinkMbps < 4.0) return 'medium';
      return 'high';
    } catch {
      return 'medium';
    }
  }

  static applyFakeABR(wrapper: any, playerInstance: any) {
    const tier = this.getNetworkTier(playerInstance);

    if (tier === 'low') {
      wrapper.safeConfigure({
        streaming: { bufferingGoal: 30, rebufferingGoal: 15, liveSyncDuration: 8 }
      });
    } else if (tier === 'medium') {
      wrapper.safeConfigure({
        streaming: { bufferingGoal: 20, rebufferingGoal: 7, liveSyncDuration: 6 }
      });
    } else {
      wrapper.safeConfigure({
        streaming: { bufferingGoal: 12, rebufferingGoal: 5, liveSyncDuration: 5 }
      });
    }
  }
}
