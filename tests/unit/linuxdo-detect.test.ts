import { describe, expect, it } from 'vitest';
import { classifyLinuxDoPage } from '../../src/sites/linuxdo/detect';

describe('classifyLinuxDoPage', () => {
  it('rejects non Linux.do URLs', () => {
    const result = classifyLinuxDoPage({
      url: 'https://example.com/t/topic/1',
      hasAppRoot: true,
      hasLoginButton: false,
      hasUserMenu: false,
      hasTopicTitle: true,
      hasTopicPost: true,
      hasTopicList: false,
    });

    expect(result.supported).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('detects logged-in topic pages', () => {
    const result = classifyLinuxDoPage({
      url: 'https://linux.do/t/example-topic/123',
      hasAppRoot: true,
      hasLoginButton: false,
      hasUserMenu: true,
      hasTopicTitle: true,
      hasTopicPost: true,
      hasTopicList: false,
    });

    expect(result).toMatchObject({
      supported: true,
      siteId: 'linuxdo',
      loggedIn: true,
      pageType: 'topic',
      confidence: 0.8,
    });
  });

  it('detects anonymous topic lists', () => {
    const result = classifyLinuxDoPage({
      url: 'https://linux.do/latest',
      hasAppRoot: true,
      hasLoginButton: true,
      hasUserMenu: false,
      hasTopicTitle: false,
      hasTopicPost: false,
      hasTopicList: true,
    });

    expect(result).toMatchObject({
      supported: true,
      loggedIn: false,
      pageType: 'topic-list',
    });
  });
});

