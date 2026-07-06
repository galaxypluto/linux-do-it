import type { SiteAdapter } from '../_types';
import { performAction } from './actions';
import { detect } from './detect';
import { extract } from './extract';
import { siteManifest } from './manifest';

export const linuxDoAdapter: SiteAdapter = {
  id: siteManifest.id,
  matches: [...siteManifest.matches],
  detect,
  extract,
  performAction,
};

