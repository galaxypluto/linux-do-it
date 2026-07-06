import type { SiteDetectionResult } from '../../ports/SitePort';
import { isLinuxDoTopicListRoute } from '../../domain/linuxdo/routes';
import { siteManifest } from './manifest';
import { selectors } from './selectors';

export type LinuxDoDetectionSignals = {
  url: string;
  hasAppRoot: boolean;
  hasLoginButton: boolean;
  hasUserMenu: boolean;
  hasTopicTitle: boolean;
  hasTopicPost: boolean;
  hasTopicList: boolean;
};

export function classifyLinuxDoPage(signals: LinuxDoDetectionSignals): SiteDetectionResult {
  const url = new URL(signals.url);
  const supported = url.hostname === 'linux.do';

  if (!supported) {
    return {
      supported: false,
      siteId: siteManifest.id,
      loggedIn: false,
      pageType: 'unknown',
      confidence: 0,
      reason: 'URL does not match Linux.do',
    };
  }

  const loggedIn = signals.hasUserMenu && !signals.hasLoginButton;
  const isTopic = signals.hasTopicTitle || signals.hasTopicPost || /^\/t\//.test(url.pathname);
  const isList = signals.hasTopicList || isLinuxDoTopicListRoute(url.pathname);
  const pageType = isTopic ? 'topic' : isList ? 'topic-list' : signals.hasLoginButton ? 'login' : 'unknown';

  return {
    supported: true,
    siteId: siteManifest.id,
    loggedIn,
    pageType,
    confidence: signals.hasAppRoot || isTopic || isList ? 0.8 : 0.4,
  };
}

export function detect(): SiteDetectionResult {
  return classifyLinuxDoPage({
    url: window.location.href,
    hasAppRoot: Boolean(document.querySelector(selectors.appRoot)),
    hasLoginButton: Boolean(document.querySelector(selectors.loginButton)),
    hasUserMenu: Boolean(document.querySelector(selectors.userMenu)),
    hasTopicTitle: Boolean(document.querySelector(selectors.topicTitle)),
    hasTopicPost: Boolean(document.querySelector(selectors.topicPost)),
    hasTopicList: Boolean(document.querySelector(selectors.topicList)),
  });
}
