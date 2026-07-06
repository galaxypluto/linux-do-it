import { describe, expect, it } from 'vitest';
import { DEBUG_STORAGE_KEYS, pickDiagnosticStorage, sanitizeDebugValue } from '../../entrypoints/debug/App';

describe('debug app diagnostic storage', () => {
  it('keeps the diagnostic storage surface on known debug keys', () => {
    const storage = {
      'debug:lastSiteDetection': { detection: { siteId: 'linuxdo' } },
      'debug:lastRuntimeMessage': { type: 'site.detect' },
      'linuxdo-reader:replyActivities': [{ message: 'private draft' }],
      unrelated: 'hidden',
    };

    expect(pickDiagnosticStorage(storage)).toEqual({
      'debug:lastSiteDetection': { detection: { siteId: 'linuxdo' } },
      'debug:lastRuntimeMessage': { type: 'site.detect' },
    });
  });

  it('removes reply body text from the last reply activity debug value', () => {
    const value = sanitizeDebugValue('debug:lastReplyActivity', {
      id: 'activity-1',
      topicId: 42,
      status: 'synced',
      message: 'reply body text',
    });

    expect(value).toEqual({
      id: 'activity-1',
      topicId: 42,
      status: 'synced',
    });
  });

  it('tracks all extension debug keys in one exported allowlist', () => {
    expect(DEBUG_STORAGE_KEYS).toEqual([
      'debug:lastSiteDetection',
      'debug:lastPageSnapshot',
      'debug:lastRuntimeMessage',
      'debug:lastContentReader',
      'debug:lastNativeAction',
      'debug:lastReplyActivity',
    ]);
  });
});
