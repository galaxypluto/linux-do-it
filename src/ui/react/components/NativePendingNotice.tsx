import type { TopicCardData } from "../../../discourse/types";
import { topicCategoryLabel } from "../../pendingNoticeModel";

type NativePendingNoticeProps = {
  count: number;
  topics: TopicCardData[];
  expanded: boolean;
};

export function NativePendingNotice({ count, topics, expanded }: NativePendingNoticeProps) {
  const hasPendingTopics = count > 0;
  const menuOpen = expanded && hasPendingTopics;

  return (
    <>
      <button
        type="button"
        className="ldcv-native-notice__trigger"
        data-action="toggle-pending-preview"
        aria-haspopup={hasPendingTopics ? "menu" : "false"}
        aria-expanded={menuOpen ? "true" : "false"}
        aria-label={`查看 ${count} 个新话题`}
        title={hasPendingTopics ? "查看新话题" : "暂无新话题"}
        aria-disabled={hasPendingTopics ? "false" : "true"}
      >
        <span>新帖</span>
        <strong>{count}</strong>
      </button>
      {menuOpen && (
        <div className="ldcv-native-notice__menu" role="menu" aria-label="新话题菜单">
          <div className="ldcv-native-notice__head">
            <div>
              <strong>发现 {count} 个新话题</strong>
              <span>只检测全新发布的话题，确认后再更新。</span>
            </div>
            <button type="button" className="ldcv-native-notice__update" data-action="apply-pending-refresh">
              更新
            </button>
          </div>
          <div className="ldcv-native-notice__list">
            {topics.map((topic) => (
              <button key={topic.id} type="button" data-pending-topic-id={topic.id} role="menuitem">
                <span>
                  <mark className="ldcv-new-marker">new</mark>
                  {topic.title}
                </span>
                <em>{topicCategoryLabel(topic)}</em>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
