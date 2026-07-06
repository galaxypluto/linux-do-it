import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detect } from '../../src/sites/linuxdo/detect';
import { extract } from '../../src/sites/linuxdo/extract';

const fixtureRoot = path.resolve('src/sites/linuxdo/fixtures');

describe('Linux.do fixture detection and extraction', () => {
  it('detects anonymous topic list fixtures', () => {
    loadFixture('topic-list.html', 'https://linux.do/latest');

    expect(detect()).toMatchObject({
      supported: true,
      siteId: 'linuxdo',
      loggedIn: false,
      pageType: 'topic-list',
    });

    expect(extract()).toMatchObject({
      siteId: 'linuxdo',
      pageType: 'topic-list',
      metadata: {
        pathname: '/latest',
        endpoint: '/latest.json',
      },
    });
  });

  it.each([
    ['topic-list.live-latest.html', 'https://linux.do/latest', '/latest', '/latest.json'],
    ['topic-list.live-top.html', 'https://linux.do/top', '/top', '/top.json'],
    ['topic-list.live-new-restricted.html', 'https://linux.do/new', '/new', '/new.json'],
  ])('detects live-derived anonymous list fixture %s', (fixtureName, url, pathname, endpoint) => {
    loadFixture(fixtureName, url);

    expect(detect()).toMatchObject({
      supported: true,
      siteId: 'linuxdo',
      loggedIn: false,
      pageType: 'topic-list',
    });

    expect(extract()).toMatchObject({
      siteId: 'linuxdo',
      pageType: 'topic-list',
      metadata: {
        pathname,
        endpoint,
      },
    });
  });

  it('detects logged-in topic fixtures', () => {
    loadFixture('topic.html', 'https://linux.do/t/example-topic/123');

    expect(detect()).toMatchObject({
      supported: true,
      siteId: 'linuxdo',
      loggedIn: true,
      pageType: 'topic',
    });

    const snapshot = extract();
    expect(snapshot.metadata).toMatchObject({
      pathname: '/t/example-topic/123',
      endpoint: null,
    });
    expect(snapshot.text).toContain('First post body.');
  });

  it('detects live-derived anonymous public topic fixtures', () => {
    loadFixture('topic.live-public.html', 'https://linux.do/t/fixture-public-topic/4001');

    expect(detect()).toMatchObject({
      supported: true,
      siteId: 'linuxdo',
      loggedIn: false,
      pageType: 'topic',
    });

    const snapshot = extract();
    expect(snapshot.metadata).toMatchObject({
      pathname: '/t/fixture-public-topic/4001',
      endpoint: null,
    });
    expect(snapshot.text).toContain('Fixture public topic body.');
  });
});

function loadFixture(name: string, url: string) {
  window.history.pushState({}, '', url);
  document.documentElement.innerHTML = `<head><title>Fixture</title></head><body>${fs.readFileSync(
    path.join(fixtureRoot, name),
    'utf8',
  )}</body>`;
}
