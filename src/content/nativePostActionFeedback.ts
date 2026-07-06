import type { ReaderPostActionFeedback } from "../ui/readerTypes";

export function shouldAutoDismissNativePostActionFeedback(feedback: ReaderPostActionFeedback | null): boolean {
  return feedback?.status === "success" && !feedback.fallbackUrl;
}

export function shouldClearComposerOpenedFeedback(feedback: ReaderPostActionFeedback | null): boolean {
  return Boolean(
    feedback &&
      (feedback.action === "reply" || feedback.action === "private-message") &&
      feedback.status === "success"
  );
}
