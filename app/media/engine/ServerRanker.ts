import { ServerStat } from '../types/media';

export class ServerRanker {
  static getServerScore(s: ServerStat): number {
    return (
      (s.successCount * 10) -
      (s.failCount * 20) -
      (s.stallCount * 5) -
      (s.avgLoadTime * 0.5)
    );
  }

  static pickBestServer(servers: ServerStat[]): ServerStat | null {
    if (!servers || servers.length === 0) return null;
    return servers
      .map(s => ({ ...s, score: this.getServerScore(s) }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  }
}
