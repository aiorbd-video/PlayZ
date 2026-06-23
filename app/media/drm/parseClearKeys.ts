export const parseClearKeys = (
  drmData: string | Record<string, string> | undefined
): Record<string, string> => {
  if (!drmData) return {};

  try {
    let data: any = drmData;

    if (typeof drmData === 'string') {
      const trimmed = drmData.trim();

      if (trimmed.startsWith('{')) {
        data = JSON.parse(trimmed);
      } else if (trimmed.includes(':')) {
        const [kid, key] = trimmed.split(':').map(v => v.trim());
        if (kid && key) return { [kid]: key };
        return {};
      } else {
        return {};
      }
    }

    if (typeof data !== 'object') return {};

    const result: Record<string, string> = {};

    for (const [kid, key] of Object.entries(data)) {
      if (kid && key) {
        result[String(kid).trim()] = String(key).trim();
      }
    }

    return result;
  } catch (err) {
    console.error('parseClearKeys failed:', err);
    return {};
  }
};
