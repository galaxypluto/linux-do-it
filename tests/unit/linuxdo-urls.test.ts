import { describe, expect, it } from 'vitest';
import { linuxDoAbsoluteUrl, linuxDoClassicTopicPath, linuxDoClassicTopicUrl, linuxDoNestedTopicPath, linuxDoNestedTopicUrl, linuxDoPreferredTopicUrl } from '../../src/domain/linuxdo/urls';

describe('linuxDoAbsoluteUrl', () => {
  it('resolves relative Linux.do paths against the canonical origin', () => {
    expect(linuxDoAbsoluteUrl('/t/topic/10/2')).toBe('https://linux.do/t/topic/10/2');
  });

  it('preserves absolute URLs', () => {
    expect(linuxDoAbsoluteUrl('https://linux.do/latest')).toBe('https://linux.do/latest');
  });

  it('falls back to the origin for empty values', () => {
    expect(linuxDoAbsoluteUrl('')).toBe('https://linux.do');
  });
});

describe('linuxDoClassicTopicPath', () => {
  it('builds classic topic paths with encoded slugs and optional post numbers', () => {
    expect(linuxDoClassicTopicPath('hello world', 10)).toBe('/t/hello%20world/10');
    expect(linuxDoClassicTopicPath('topic', 10, 4)).toBe('/t/topic/10/4');
  });
});

describe('linuxDoClassicTopicUrl', () => {
  it('converts nested topic URLs back to classic topic URLs', () => {
    expect(linuxDoClassicTopicUrl('/n/topic/10/2')).toBe('/t/topic/10/2');
    expect(linuxDoClassicTopicUrl('https://linux.do/n/topic/10?sort=old#post_2')).toBe(
      'https://linux.do/t/topic/10?sort=old#post_2',
    );
  });

  it('leaves non-topic and already classic URLs unchanged', () => {
    expect(linuxDoClassicTopicUrl('/t/topic/10')).toBe('/t/topic/10');
    expect(linuxDoClassicTopicUrl('/latest')).toBe('/latest');
  });
});

describe('linuxDoPreferredTopicUrl', () => {
  it('selects classic or nested topic URLs from the same source path', () => {
    expect(linuxDoPreferredTopicUrl('/t/topic/10/2', 'classic')).toBe('/t/topic/10/2');
    expect(linuxDoPreferredTopicUrl('/t/topic/10/2', 'nested')).toBe('/n/topic/10/2');
    expect(linuxDoPreferredTopicUrl('/n/topic/10/2', 'classic')).toBe('/t/topic/10/2');
  });
});

describe('linuxDoNestedTopicPath', () => {
  it('builds nested topic paths with encoded slugs and optional post numbers', () => {
    expect(linuxDoNestedTopicPath('hello world', 10)).toBe('/n/hello%20world/10');
    expect(linuxDoNestedTopicPath('topic', 10, 4)).toBe('/n/topic/10/4');
  });
});

describe('linuxDoNestedTopicUrl', () => {
  it('converts regular topic URLs to native nested topic URLs', () => {
    expect(linuxDoNestedTopicUrl('/t/topic/10/2')).toBe('/n/topic/10/2');
    expect(linuxDoNestedTopicUrl('https://linux.do/t/topic/10?sort=old#post_2')).toBe(
      'https://linux.do/n/topic/10?sort=old#post_2',
    );
  });

  it('leaves non-topic and already nested URLs unchanged', () => {
    expect(linuxDoNestedTopicUrl('/n/topic/10')).toBe('/n/topic/10');
    expect(linuxDoNestedTopicUrl('/latest')).toBe('/latest');
  });
});
