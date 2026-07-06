import * as React from "react";
import type { ReaderState } from "../../readerTypes";
import { icons } from "../../icons";

type ReaderNavProps = {
  reader: ReaderState;
  navigation: { previous: boolean; next: boolean };
  onRefreshReader?: () => void;
  onReaderAdjacent?: (direction: 1 | -1) => void;
};

export function ReaderNav({
  reader,
  navigation,
  onRefreshReader,
  onReaderAdjacent
}: ReaderNavProps): React.ReactElement {
  const creditViewRetry = reader.creditViewTrackingPhase === "failed";
  const canRefresh = Boolean(reader.data) && !reader.loading && !reader.refreshing;

  return (
    <div className="ldcv-reader-nav" aria-label="阅读切换">
      <button
        type="button"
        disabled={!canRefresh}
        className={reader.refreshing ? "is-spinning" : ""}
        title={creditViewRetry ? "重试信用浏览计数" : "刷新当前帖子"}
        aria-label={creditViewRetry ? "重试信用浏览计数" : "刷新当前帖子"}
        onClick={onRefreshReader}
        dangerouslySetInnerHTML={{ __html: icons.refresh }}
      />
      <button
        type="button"
        disabled={!navigation.previous}
        title="上一个帖子"
        aria-label="上一个帖子"
        onClick={() => onReaderAdjacent?.(-1)}
        dangerouslySetInnerHTML={{ __html: icons.previous }}
      />
      <button
        type="button"
        disabled={!navigation.next}
        title="下一个帖子"
        aria-label="下一个帖子"
        onClick={() => onReaderAdjacent?.(1)}
        dangerouslySetInnerHTML={{ __html: icons.next }}
      />
    </div>
  );
}
