type ToolbarPendingNoticeProps = {
  count: number;
  expanded: boolean;
};

/**
 * Toolbar pending new-topic summary shown inside the app toolbar popover.
 *
 * Rendered into a stable `.ldcv-toolbar-pending` host by
 * `src/ui/toolbarPendingNotice.ts`. Event binding stays owned by
 * `bindActions(...)` via root-scoped `data-action` selectors, so this
 * component only owns the visible markup and label contracts.
 */
export function ToolbarPendingNotice({ count, expanded }: ToolbarPendingNoticeProps) {
  return (
    <div className="ldcv-toolbar-pending" role="status" aria-live="polite">
      <div>
        <strong>发现 {count} 个新话题</strong>
        <span>确认后再更新列表</span>
      </div>
      <div className="ldcv-toolbar-pending__actions">
        <button type="button" data-action="toggle-pending-preview">
          {expanded ? "收起" : "新帖"}
        </button>
        <button type="button" data-action="apply-pending-refresh">
          更新
        </button>
      </div>
    </div>
  );
}
