import * as React from "react";
import { cn } from "../lib/cn";
import type { TopicCardData } from "../../../discourse/types";
import { DEFAULT_TOPIC_LABEL_MAX_TAGS } from "../../cards";

type TopicLabelsProps = {
  category?: TopicCardData["category"];
  tags: string[];
  extraLabels?: React.ReactNode;
  className?: string;
  maxTags?: number;
};

export function TopicLabels({
  category,
  tags,
  extraLabels,
  className,
  maxTags = DEFAULT_TOPIC_LABEL_MAX_TAGS
}: TopicLabelsProps): React.ReactElement | null {
  const categoryLabel = category ? (
    <span
      className="ldcv-category"
      title={`分类层级：${category.parentName ? `${category.parentName} / ${category.name}` : category.name}`}
    >
      {category.name}
    </span>
  ) : null;

  const visibleTags = typeof maxTags === "number" && maxTags >= 0 ? tags.slice(0, maxTags) : tags;
  const hiddenTags = tags.slice(visibleTags.length);

  const tagLabels = tags.length > 0 ? (
    <div className="ldcv-tags ldcv-tags--inline">
      {visibleTags.map((tag) => (
        <span key={tag} className="ldcv-tag">
          {tag}
        </span>
      ))}
      {hiddenTags.length > 0 && (
        <span className="ldcv-tag ldcv-tag--more" title={tags.join(" / ")}>
          +{hiddenTags.length}
        </span>
      )}
    </div>
  ) : null;

  if (!categoryLabel && !tagLabels && !extraLabels) {
    return null;
  }

  return (
    <div className={cn("ldcv-topic-labels", className)}>
      {categoryLabel}
      {tagLabels}
      {extraLabels}
    </div>
  );
}
