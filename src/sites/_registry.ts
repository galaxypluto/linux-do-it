import { linuxDoAdapter } from './linuxdo';
import type { SiteAdapter } from './_types';

export const siteAdapters: SiteAdapter[] = [linuxDoAdapter];

export async function detectActiveSiteWithAdapter() {
  const results = await Promise.all(
    siteAdapters.map(async (adapter) => ({
      adapter,
      detection: await adapter.detect(),
    })),
  );

  return (
    results
      .filter((result) => result.detection.supported)
      .sort((a, b) => b.detection.confidence - a.detection.confidence)[0] ?? null
  );
}

export async function detectActiveSite() {
  return (await detectActiveSiteWithAdapter())?.detection ?? null;
}
