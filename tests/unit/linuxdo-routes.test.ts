import { describe, expect, it } from 'vitest';
import {
  endpointForLinuxDoRoute,
  isLinuxDoTopicListRoute,
  parseLinuxDoNestedTopicRoute,
  parseLinuxDoTopicRoute
} from '../../src/domain/linuxdo/routes';

function linuxDoLocation(pathAndSearch: string) {
  return new URL(pathAndSearch, 'https://linux.do');
}

describe('isLinuxDoTopicListRoute', () => {
  it('accepts supported topic list routes', () => {
    expect(isLinuxDoTopicListRoute('/')).toBe(true);
    expect(isLinuxDoTopicListRoute('/latest')).toBe(true);
    expect(isLinuxDoTopicListRoute('/new')).toBe(true);
    expect(isLinuxDoTopicListRoute('/unseen')).toBe(true);
    expect(isLinuxDoTopicListRoute('/unread')).toBe(true);
    expect(isLinuxDoTopicListRoute('/hot')).toBe(true);
    expect(isLinuxDoTopicListRoute('/top/weekly')).toBe(true);
    expect(isLinuxDoTopicListRoute('/posted')).toBe(true);
    expect(isLinuxDoTopicListRoute('/bookmarks')).toBe(true);
    expect(isLinuxDoTopicListRoute('/c/development/12')).toBe(true);
    expect(isLinuxDoTopicListRoute('/tag/chrome-extension')).toBe(true);
    expect(isLinuxDoTopicListRoute('/tags')).toBe(true);
  });

  it('rejects topic detail and user routes', () => {
    expect(isLinuxDoTopicListRoute('/t/example-topic/123')).toBe(false);
    expect(isLinuxDoTopicListRoute('/u/example/summary')).toBe(false);
  });
});

describe('endpointForLinuxDoRoute', () => {
  it.each([
    ['/', '/latest.json'],
    ['/latest', '/latest.json'],
    ['/latest?page=2', '/latest.json?page=2'],
    ['/new', '/new.json'],
    ['/unseen', '/unseen.json'],
    ['/unread', '/unread.json'],
    ['/hot', '/hot.json'],
    ['/posted', '/posted.json'],
    ['/bookmarks', '/bookmarks.json'],
    ['/c/development/12', '/c/development/12.json'],
    ['/c/development/12?page=3', '/c/development/12.json?page=3'],
    ['/tag/chrome-extension', '/tag/chrome-extension.json'],
    ['/tags', '/tags.json'],
  ])('maps %s to %s', (route, endpoint) => {
    expect(endpointForLinuxDoRoute(linuxDoLocation(route))).toBe(endpoint);
  });

  it('preserves top period routes', () => {
    expect(endpointForLinuxDoRoute(linuxDoLocation('/top/weekly'))).toBe('/top.json?period=weekly');
    expect(endpointForLinuxDoRoute(linuxDoLocation('/top/monthly?page=2'))).toBe(
      '/top.json?period=monthly&page=2',
    );
  });

  it('normalizes encoded tag segments', () => {
    expect(endpointForLinuxDoRoute(linuxDoLocation('/tag/%E6%8F%92%E4%BB%B6'))).toBe(
      '/tag/%E6%8F%92%E4%BB%B6.json',
    );
  });
});

describe('parseLinuxDoTopicRoute', () => {
  it.each([
    ['/t/example-topic/123', { topicId: 123, slug: 'example-topic', postNumber: null }],
    ['/t/topic/456', { topicId: 456, slug: 'topic', postNumber: null }],
    ['/t/example-topic/123/7', { topicId: 123, slug: 'example-topic', postNumber: 7 }],
    ['/t/%E6%B5%8B%E8%AF%95/88/2', { topicId: 88, slug: '%E6%B5%8B%E8%AF%95', postNumber: 2 }],
  ])('parses %s', (route, expected) => {
    expect(parseLinuxDoTopicRoute(linuxDoLocation(route))).toEqual(expected);
  });

  it('rejects non-topic routes and invalid ids', () => {
    expect(parseLinuxDoTopicRoute(linuxDoLocation('/latest'))).toBeNull();
    expect(parseLinuxDoTopicRoute(linuxDoLocation('/t/example/not-a-number'))).toBeNull();
  });
});

describe('parseLinuxDoNestedTopicRoute', () => {
  it.each([
    ['/n/example-topic/123', { topicId: 123, slug: 'example-topic', postNumber: null }],
    ['/n/topic/456', { topicId: 456, slug: 'topic', postNumber: null }],
    ['/n/example-topic/123/7', { topicId: 123, slug: 'example-topic', postNumber: 7 }],
  ])('parses %s', (route, expected) => {
    expect(parseLinuxDoNestedTopicRoute(linuxDoLocation(route))).toEqual(expected);
  });

  it('rejects non-nested routes and invalid ids', () => {
    expect(parseLinuxDoNestedTopicRoute(linuxDoLocation('/t/example-topic/123'))).toBeNull();
    expect(parseLinuxDoNestedTopicRoute(linuxDoLocation('/n/example/not-a-number'))).toBeNull();
  });
});
