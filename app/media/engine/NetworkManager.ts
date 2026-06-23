export class NetworkManager {
  private static bwHistory: number[] = [4.5, 4.5, 4.5, 4.5, 4.5]; // Baseline sample stream trace
  private static lastKnownTier: 'very_low' | 'low' | 'medium' | 'high' | 'ultra' = 'medium';

  static pushBandwidthSample(bps: number) {
    if (!bps || isNaN(bps)) return;
    const mbps = bps / 1000000;
    this.bwHistory.push(mbps);
    if (this.bwHistory.length > 6) {
      this.bwHistory.shift(); // Keep latest 30s sliding metric window (6 samples * 5s)
    }
  }

  static detectTrend(): 'stable' | 'collapsing' | 'improving' {
    if (this.bwHistory.length < 3) return 'stable';
    const len = this.bwHistory.length;
    
    // Check if the bandwidth sequence is dropping dramatically
    const recent = this.bwHistory[len - 1];
    const middle = this.bwHistory[len - 2];
    const older = this.bwHistory[len - 3];

    if (recent < middle && middle < older && recent < (older * 0.6)) {
      return 'collapsing'; // Network collapsing detected!
    }
    if (recent > middle && middle > older) return 'improving';
    return 'stable';
  }

  static getNetworkTier(): 'very_low' | 'low' | 'medium' | 'high' | 'ultra' {
    if (this.bwHistory.length === 0) return this.lastKnownTier;
    const currentMbps = this.bwHistory[this.bwHistory.length - 1];

    if (currentMbps <= 1.0) this.lastKnownTier = 'very_low';
    else if (currentMbps <= 3.0) this.lastKnownTier = 'low';
    else if (currentMbps <= 6.0) this.lastKnownTier = 'medium';
    else if (currentMbps <= 15.0) this.lastKnownTier = 'high';
    else this.lastKnownTier = 'ultra';

    return this.lastKnownTier;
  }

  static applySmartABREngine(wrapper: any, playerInstance: any, loggerRef: any) {
    if (!wrapper || !playerInstance) return;

    try {
      const stats = playerInstance.getStats();
      if (stats && stats.estimatedBandwidth) {
        this.pushBandwidthSample(stats.estimatedBandwidth);
      }
    } catch {}

    const tier = this.getNetworkTier();
    const trend = this.detectTrend();
    const config = playerInstance.getConfiguration();
    const currentGoal = config?.streaming?.bufferingGoal;

    let targetGoal = 20;
    let targetRebuff = 7;

    // AI Check: Cascade inflation rules based on network trends
    if (trend === 'collapsing') {
      loggerRef.current?.addLog(`⚠️ Network AI: Impending crash trace observed. Proactively expanding buffer to 35s!`, 'warn');
      targetGoal = 35;
      targetRebuff = 15;
    } else {
      switch (tier) {
        case 'very_low': targetGoal = 30; targetRebuff = 12; break;
        case 'low': targetGoal = 25; targetRebuff = 10; break;
        case 'medium': targetGoal = 20; targetRebuff = 7; break;
        case 'high': targetGoal = 14; targetRebuff = 5; break;
        case 'ultra': targetGoal = 8; targetRebuff = 3; break;
      }
    }

    if (currentGoal !== targetGoal) {
      wrapper.safeConfigure({
        streaming: {
          bufferingGoal: targetGoal,
          rebufferingGoal: targetRebuff,
          liveSyncDuration: trend === 'collapsing' ? 10 : (tier === 'very_low' ? 8 : 5)
        }
      });
    }
  }
}
