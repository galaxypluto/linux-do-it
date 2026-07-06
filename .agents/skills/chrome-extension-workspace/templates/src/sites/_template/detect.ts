import type { SiteDetectionResult } from '../../ports/SitePort';
import { siteManifest } from './manifest';
import { selectors } from './selectors';

export function detect(): SiteDetectionResult {
  const url = new URL(window.location.href);
  const supported = siteManifest.matches.some((pattern) => url.origin === new URL(pattern.replace('*', '')).origin);

  if (!supported) {
    return {
      supported: false,
      siteId: siteManifest.id,
      loggedIn: false,
      pageType: 'unknown',
      confidence: 0,
      reason: 'URL does not match site manifest',
    };
  }

  const hasLoginForm = Boolean(document.querySelector(selectors.loginForm));
  const hasDashboard = Boolean(document.querySelector(selectors.dashboardRoot));

  return {
    supported: true,
    siteId: siteManifest.id,
    loggedIn: hasDashboard && !hasLoginForm,
    pageType: hasDashboard ? 'dashboard' : hasLoginForm ? 'login' : 'unknown',
    confidence: hasDashboard || hasLoginForm ? 0.8 : 0.4,
  };
}
