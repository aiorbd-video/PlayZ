export type DRMType = 'clearkey' | 'widevine' | 'playready' | 'unknown';

export interface DRMConfig {
  type: DRMType;
  clearKeys?: Record<string, string>;
  licenseUrl?: string;
  raw?: any;
}

export const parseDRM = (
  drmData: string | Record<string, any> | undefined
): DRMConfig => {
  if (!drmData) {
    return { type: 'unknown' };
  }

  try {
    let data: any = drmData;

    // =============================
    // 1. STRING INPUT HANDLING
    // =============================
    if (typeof drmData === 'string') {
      const raw = drmData.trim();

      // JSON string
      if (raw.startsWith('{')) {
        data = JSON.parse(raw);
      }

      // ClearKey inline format: kid:key
      else if (raw.includes(':') && !raw.includes('http')) {
        const [kid, key] = raw.split(':').map(v => v.trim());
        return {
          type: 'clearkey',
          clearKeys: kid && key ? { [kid]: key } : {},
          raw
        };
      }

      // License URL (Widevine / PlayReady)
      else if (raw.startsWith('http')) {
        return {
          type: detectLicenseType(raw),
          licenseUrl: raw,
          raw
        };
      }

      return { type: 'unknown', raw };
    }

    // =============================
    // 2. OBJECT INPUT HANDLING
    // =============================
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);

      // ClearKey detection
      if (keys.length > 0 && typeof data[keys[0]] === 'string') {
        const clean: Record<string, string> = {};

        for (const [k, v] of Object.entries(data)) {
          clean[String(k).trim()] = String(v).trim();
        }

        return {
          type: 'clearkey',
          clearKeys: clean,
          raw: data
        };
      }

      // Widevine / PlayReady object config
      if (data.licenseUrl || data.widevine || data.playready) {
        const url = data.licenseUrl || data.widevine || data.playready;

        return {
          type: data.playready ? 'playready' : 'widevine',
          licenseUrl: url,
          raw: data
        };
      }
    }

    return { type: 'unknown', raw: data };
  } catch (err) {
    console.error('DRM parse failed:', err);
    return { type: 'unknown' };
  }
};

// =============================
// Helper: license type guess
// =============================
const detectLicenseType = (url: string): DRMType => {
  const u = url.toLowerCase();

  if (u.includes('widevine')) return 'widevine';
  if (u.includes('playready')) return 'playready';

  // default fallback
  return 'widevine';
};
