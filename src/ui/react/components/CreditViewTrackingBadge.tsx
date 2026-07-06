import * as React from "react";
import { CREDIT_TOPIC_VIEW_DWELL_MS } from "../../../shared/creditViewTracking";
import type { CreditViewTrackingPhase } from "../../readerTypes";

type CreditViewTrackingBadgeProps = {
  phase: CreditViewTrackingPhase | null | undefined;
  startedAt: number | null | undefined;
  dwellMs?: number;
  className?: string;
};

export function CreditViewTrackingBadge({
  phase,
  startedAt,
  dwellMs = CREDIT_TOPIC_VIEW_DWELL_MS,
  className = "",
}: CreditViewTrackingBadgeProps): React.ReactElement | null {
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (phase !== "countdown" || !startedAt) {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      const remainingMs = startedAt + dwellMs - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [dwellMs, phase, startedAt]);

  if (!phase || !startedAt) {
    return null;
  }

  const failed = phase === "failed";
  const showSeconds = phase === "countdown" && secondsLeft !== null && secondsLeft > 0;
  const title = failed
    ? "信用浏览计数失败，点击顶部刷新按钮重试"
    : phase === "requesting"
      ? "正在提交信用浏览计数"
      : "正在累计信用浏览时长，倒计时结束后计入今日话题浏览";

  return (
    <span
      className={`ldcv-credit-view-tracker${failed ? " is-failed" : ""}${className ? ` ${className}` : ""}`}
      title={title}
      aria-live="polite"
      aria-label={
        failed
          ? "信用浏览计数失败"
          : showSeconds
            ? `信用浏览倒计时 ${secondsLeft} 秒`
            : "信用浏览计数中"
      }
    >
      <span
        className={`ldcv-credit-view-dot${failed ? " is-failed" : " is-active"}`}
        aria-hidden="true"
      />
      {showSeconds ? (
        <span className="ldcv-credit-view-tracker__seconds">{secondsLeft}s</span>
      ) : null}
    </span>
  );
}
