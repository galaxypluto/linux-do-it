import type { AiPort } from '../ports/AiPort';
import type { SitePort } from '../ports/SitePort';
import type { StoragePort } from '../ports/StoragePort';
import type { TelemetryPort } from '../ports/TelemetryPort';

export class AnalyzeCurrentPageUseCase {
  constructor(
    private readonly site: SitePort,
    private readonly ai: AiPort,
    private readonly storage: StoragePort,
    private readonly telemetry: TelemetryPort,
  ) {}

  async execute(tabId: string) {
    const detection = await this.site.detect();

    if (!detection.supported) {
      this.telemetry.warn('site.unsupported', { reason: detection.reason });
      throw new Error(detection.reason ?? 'Unsupported site');
    }

    if (!detection.loggedIn) {
      this.telemetry.warn('site.notLoggedIn', { siteId: detection.siteId });
      throw new Error('Target site requires login');
    }

    const snapshot = await this.site.getPageSnapshot(tabId);
    const result = await this.ai.analyze(snapshot);

    await this.storage.set(`analysis:${tabId}`, result);
    this.telemetry.info('analysis.completed', {
      siteId: detection.siteId,
      pageType: detection.pageType,
    });

    return result;
  }
}
