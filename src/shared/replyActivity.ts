import { z } from "zod";

export const REPLY_ACTIVITY_STORAGE_KEY = "linuxdo-reader:replyActivities";
export const REPLY_ACTIVITY_LIMIT = 12;

export const ReplyActivity = z.object({
  id: z.string().min(1),
  topicId: z.number().int().positive(),
  topicTitle: z.string(),
  topicUrl: z.string().url(),
  targetPostNumber: z.number().int().positive().nullable(),
  submittedPostNumber: z.number().int().positive().nullable(),
  submittedUrl: z.string().url().optional(),
  status: z.enum(["syncing", "synced", "sent"]),
  message: z.string(),
  createdAt: z.string()
});

export type ReplyActivity = z.infer<typeof ReplyActivity>;

export function normalizeReplyActivities(value: unknown): ReplyActivity[] {
  const parsed = z.array(ReplyActivity).safeParse(value);
  return parsed.success ? parsed.data : [];
}
