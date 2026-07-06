import * as React from "react";
import { linuxDoPreferredTopicUrl, type TopicUrlView } from "../../../domain/linuxdo/urls";

type IncompleteNoticeProps = {
  url: string;
  count: number;
  topicUrlView?: TopicUrlView;
};

export function IncompleteNotice({ url, count, topicUrlView = "classic" }: IncompleteNoticeProps): React.ReactElement {
  return (
    <div className="ldcv-reader-note">
      当前 JSON 已载入内容可能不是完整讨论，约还有 {count} 条未显示。
      <a href={linuxDoPreferredTopicUrl(url, topicUrlView)} target="_blank" rel="noopener noreferrer">打开原帖查看完整讨论</a>
    </div>
  );
}
