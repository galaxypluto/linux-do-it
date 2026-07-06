import { z } from 'zod';
import { ReplyActivity } from '../replyActivity';

export const TopicCardDataMessage = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  url: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  thumbnailUrl: z.string(),
  category: z
    .object({
      id: z.number().int(),
      name: z.string(),
      parentName: z.string(),
      color: z.string(),
      textColor: z.string(),
    })
    .optional(),
  tags: z.array(z.string()),
  stats: z.object({
    replies: z.number(),
    views: z.number(),
    likes: z.number(),
    score: z.number(),
  }),
  dates: z.object({
    createdAt: z.string(),
    activityAt: z.string(),
  }),
  flags: z.object({
    pinned: z.boolean(),
    closed: z.boolean(),
    archived: z.boolean(),
    bookmarked: z.boolean(),
    unseen: z.boolean(),
    read: z.boolean().optional(),
  }),
  posters: z.array(
    z.object({
      id: z.number().int(),
      username: z.string(),
      name: z.string(),
      avatarUrl: z.string(),
      description: z.string(),
      isOriginalPoster: z.boolean(),
    }),
  ),
});

export const RuntimeMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('site.detect'),
  }),
  z.object({
    type: z.literal('page.analyze'),
    tabId: z.string(),
  }),
  z.object({
    type: z.literal('tab.open'),
    url: z.string().url(),
    active: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('reply.activity.record'),
    activity: ReplyActivity,
  }),
]);

export type RuntimeMessage = z.infer<typeof RuntimeMessage>;

export const SidePanelContentMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ldcv.searchTopics'),
    query: z.string().trim().min(1).max(200),
    page: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('ldcv.openTopic'),
    topicId: z.number().int().positive(),
    topic: TopicCardDataMessage,
  }),
]);

export type SidePanelContentMessage = z.infer<typeof SidePanelContentMessage>;

export const SidePanelContentResponse = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    data: z.unknown().optional(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export type SidePanelContentResponse = z.infer<typeof SidePanelContentResponse>;
