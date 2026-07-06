/** 扩展发起的 Discourse 请求最小间隔，避免与 Ember 叠加成突发流量。 */
export const DISCOURSE_REQUEST_MIN_INTERVAL_MS = 1_200;

let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

/**
 * 串行化并拉开扩展侧 fetch 间隔；在发起请求前 await。
 */
export function paceDiscourseRequest(
  minIntervalMs = DISCOURSE_REQUEST_MIN_INTERVAL_MS,
): Promise<void> {
  const scheduled = chain.then(async () => {
    const waitMs = Math.max(0, lastRequestAt + minIntervalMs - Date.now());
    if (waitMs > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, waitMs);
      });
    }
    lastRequestAt = Date.now();
  });
  chain = scheduled.catch(() => {});
  return scheduled;
}

export function resetDiscourseRequestPacerForTests(): void {
  lastRequestAt = 0;
  chain = Promise.resolve();
}
