import type { TopicLoadMoreState } from "../../topicLoadMore";

type TopicLoadMoreProps = {
  state: TopicLoadMoreState;
};

export function TopicLoadMore({ state }: TopicLoadMoreProps) {
  if (state === "arranging") {
    return (
      <span className="ldcv-load-more__status">
        <i aria-hidden="true" />
        正在整理更多话题...
      </span>
    );
  }

  if (state === "loading") {
    return (
      <button type="button" data-action="load-more" disabled>
        <i aria-hidden="true" />
        正在加载更多
      </button>
    );
  }

  if (state === "idle") {
    return (
      <button type="button" data-action="load-more">
        加载更多
      </button>
    );
  }

  return <span>已经到底了</span>;
}
