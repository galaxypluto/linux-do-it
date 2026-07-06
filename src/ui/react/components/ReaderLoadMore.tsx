import * as React from "react";
import type { ReaderState } from "../../readerTypes";
import type { ExtensionSettings } from "../../../storage/settings";

type ReaderLoadMoreProps = {
  reader: ReaderState;
  missingCount: number;
  variant: "pane" | "modal";
  settings: Pick<ExtensionSettings, "autoLoadReaderComments" | "readerPostBatchSize">;
  onLoadMoreReaderPosts?: () => void;
};

export function ReaderLoadMore({
  reader,
  missingCount,
  variant,
  settings,
  onLoadMoreReaderPosts
}: ReaderLoadMoreProps): React.ReactElement | null {
  const data = reader.data;
  if (!data?.hasMorePosts) {
    return null;
  }

  const hint = settings.autoLoadReaderComments
      ? `首批由站点 topic JSON 返回；滚到列表底部会自动加载下一批 ${settings.readerPostBatchSize} 条评论。`
      : `首批由站点 topic JSON 返回；只在你点击时读取下一批 ${settings.readerPostBatchSize} 条，不会自动批量请求。`;

  return (
    <div className="ldcv-reader-loadmore">
      <div>
        <strong>还有 {missingCount || "更多"} 条评论未载入</strong>
        <span>{hint}</span>
        {reader.loadMoreError && <p>{reader.loadMoreError}</p>}
      </div>
      <button
        type="button"
        data-action="load-more-reader"
        disabled={reader.loadingMore}
        onClick={onLoadMoreReaderPosts}
      >
        {reader.loadingMore ? "正在加载" : "加载更多评论"}
      </button>
    </div>
  );
}
