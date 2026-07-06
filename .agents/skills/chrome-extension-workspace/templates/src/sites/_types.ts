import type { PageSnapshot, SiteAction, SiteDetectionResult } from '../ports/SitePort';

export type SiteAdapter = {
  id: string;
  matches: string[];
  detect(): Promise<SiteDetectionResult> | SiteDetectionResult;
  extract(): Promise<PageSnapshot> | PageSnapshot;
  performAction?(action: SiteAction): Promise<void> | void;
};
