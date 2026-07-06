import type { SiteAdapter } from '../_types';
import { siteManifest } from './manifest';
import { detect } from './detect';
import { extract } from './extract';
import { performAction } from './actions';

export const targetSiteAdapter: SiteAdapter = {
  id: siteManifest.id,
  matches: [...siteManifest.matches],
  detect,
  extract,
  performAction,
};
