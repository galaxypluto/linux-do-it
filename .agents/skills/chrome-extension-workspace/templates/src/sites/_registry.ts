import type { SiteAdapter } from './_types';
// import { targetSiteAdapter } from './targetSite';

export const siteAdapters: SiteAdapter[] = [
  // targetSiteAdapter,
];

export async function detectActiveSite() {
  const results = await Promise.all(siteAdapters.map((adapter) => adapter.detect()));
  return results
    .filter((result) => result.supported)
    .sort((a, b) => b.confidence - a.confidence)[0] ?? null;
}
