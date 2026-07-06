import type { PageSnapshot } from './SitePort';

export type AiAnalysisResult = {
  summary: string;
  actions: Array<{ label: string; value: string }>;
};

export interface AiPort {
  analyze(snapshot: PageSnapshot): Promise<AiAnalysisResult>;
}
