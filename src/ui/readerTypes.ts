import type { TopicReaderData } from "../discourse/types";
import type { ReaderPollResultData } from "../discourse/types";
import type { ReaderImageViewerState } from "./imageViewer";
import type { ReaderUserPreviewState } from "./userPreview";

export type ReaderPostAction = "reply" | "like" | "bookmark" | "flag";

export type NativeComposerAction = ReaderPostAction | "private-message";

export type ReaderPostActionStatus = "pending" | "success" | "unsupported" | "error" | "timeout";

export interface ReaderPostActionFeedback {
  requestId: string;
  postNumber: number;
  action: NativeComposerAction;
  status: ReaderPostActionStatus;
  message: string;
  replaceExisting?: boolean;
  fallbackUrl?: string;
}

export type ReaderPollVoteStatus = "pending" | "success" | "error";

export interface ReaderPollVoteFeedback {
  postId: number;
  pollName: string;
  optionIds: string[];
  status: ReaderPollVoteStatus;
  message: string;
  poll: ReaderPollResultData | null;
}

export interface ReaderModalOrigin {
  x: number;
  y: number;
  translateX?: number;
  translateY?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
  scaleX: number;
  scaleY: number;
}

export interface ReaderState {
  topicId: number | null;
  data: TopicReaderData | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  loadMoreError: string;
  refreshError: string;
  freshPostNumbers: number[];
  error: string;
  imageViewer: ReaderImageViewerState | null;
  userPreview: ReaderUserPreviewState | null;
  nativePostAction: ReaderPostActionFeedback | null;
  pollVote: ReaderPollVoteFeedback | null;
  modalOrigin?: ReaderModalOrigin | null;
  creditViewTrackingPhase?: CreditViewTrackingPhase | null;
  creditViewTrackingStartedAt?: number | null;
}

export type CreditViewTrackingPhase = "countdown" | "requesting" | "failed";
