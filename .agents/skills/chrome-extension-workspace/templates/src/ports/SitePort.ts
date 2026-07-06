export type SiteDetectionResult = {
  supported: boolean;
  siteId: string;
  loggedIn: boolean;
  pageType: string;
  confidence: number;
  reason?: string;
};

export type PageSnapshot = {
  siteId: string;
  pageType: string;
  title: string;
  url: string;
  text?: string;
  metadata?: Record<string, unknown>;
};

export type SiteAction = {
  type: string;
  payload?: unknown;
};

export interface SitePort {
  detect(): Promise<SiteDetectionResult>;
  getPageSnapshot(tabId: string): Promise<PageSnapshot>;
  performAction(action: SiteAction): Promise<void>;
}
