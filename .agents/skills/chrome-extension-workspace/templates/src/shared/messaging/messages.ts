import { z } from 'zod';

export const DetectSiteMessage = z.object({
  type: z.literal('site.detect'),
});

export const AnalyzeCurrentPageMessage = z.object({
  type: z.literal('page.analyze'),
  tabId: z.string(),
});

export const RuntimeMessage = z.discriminatedUnion('type', [
  DetectSiteMessage,
  AnalyzeCurrentPageMessage,
]);

export type RuntimeMessage = z.infer<typeof RuntimeMessage>;
