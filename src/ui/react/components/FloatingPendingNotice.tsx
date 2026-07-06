import type { TopicCardData } from "../../../discourse/types";
import { topicCategoryLabel } from "../../pendingNoticeModel";

type FloatingPendingNoticeProps = {
  count: number;
  topics: TopicCardData[];
  expanded: boolean;
  minimized: boolean;
};

export function FloatingPendingNotice({ count, topics, expanded, minimized }: FloatingPendingNoticeProps) {
  if (minimized) {
    return <>新帖 {count}</>;
  }

  return (
    <>
      <div className="ldcv-update-float__body">
        <div>
          <strong>发现 {count} 个新话题</strong>
          <span>只检测全新发布的话题，确认后再更新。</span>
        </div>
        <div className="ldcv-update-float__actions">
          <button type="button" data-action="toggle-pending-preview">
            新帖
          </button>
          <button type="button" data-action="apply-pending-refresh">
            更新
          </button>
          <button type="button" data-action="minimize-pending-notice">
            收起
          </button>
        </div>
      </div>
      {expanded && (
        <div className="ldcv-update-float__list" aria-label="新话题列表">
          {topics.map((topic) => (
            <button key={topic.id} type="button" data-pending-topic-id={topic.id}>
              <span>
                <mark className="ldcv-new-marker">new</mark>
                {topic.title}
              </span>
              <em>{topicCategoryLabel(topic)}</em>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
