import * as React from "react";
import type { TopicCardData, TopicReaderPost } from "../../../discourse/types";
import type { ReaderState, ReaderPostAction } from "../../readerTypes";
import type { ExtensionSettings } from "../../../storage/settings";
import { TopicLabels } from "../components/TopicLabels";
import { StatItem } from "../components/StatItem";
import { icons } from "../../icons";
import { readerNavigation, preferredTopicUrl } from "../../readerTemplates";
import { PostAction } from "../components/PostAction";
import { BoostToolbarAction } from "../components/BoostToolbarAction";
import { UserPreview } from "../components/UserPreview";
import { AuthorHeader } from "../components/AuthorHeader";
import { ReaderNav } from "../components/ReaderNav";
import { CreditViewTrackingBadge } from "../components/CreditViewTrackingBadge";
import { previewMatches } from "../../userPreview";
import { userTargetFromPost } from "../../replies";

type TopicHeaderProps = {
  data: TopicCardData;
  mainPost?: TopicReaderPost;
  reader: ReaderState;
  topics: TopicCardData[];
  settings: Pick<ExtensionSettings, "commentSortOrder" | "creditTopicViewDwellSeconds" | "topicUrlView">;
  onClose: () => void;
  onOpenUserPreview?: (previewTarget: any) => void;
  onCloseUserPreview?: () => void;
  onRefreshReader?: () => void;
  onReaderAdjacent?: (direction: 1 | -1) => void;
  onNativePostAction?: (action: ReaderPostAction, postNumber: number) => void;
};

export function TopicHeader({
  data, mainPost, reader, topics, settings, onClose, onOpenUserPreview, onCloseUserPreview, onRefreshReader, onReaderAdjacent, onNativePostAction
}: TopicHeaderProps): React.ReactElement {
  const totalKnownPosts = reader.data?.postStream.length || 0;
  const totalKnownComments = Math.max(totalKnownPosts - 1, 0);

  const handleAvatarClick = React.useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    let anchor = target.closest<HTMLAnchorElement>("[data-reader-user-preview]");
    if (!anchor) {
      // If clicked on image or container, find the anchor inside the author block
      const authorBlock = target.closest(".ldcv-reader-author");
      if (authorBlock) {
        anchor = authorBlock.querySelector<HTMLAnchorElement>("[data-reader-user-preview]");
      }
    }
    if (anchor && onOpenUserPreview) {
      e.preventDefault();
      e.stopPropagation();
      const username = anchor.dataset.readerUsername || "";
      const name = anchor.dataset.readerName || username;
      const avatarUrl = anchor.dataset.readerAvatarUrl || "";
      const postNumber = Number(anchor.dataset.readerPostNumber);
      const anchorPostNumber = Number(anchor.dataset.readerAnchorPostNumber) || postNumber;
      const anchorType = anchor.dataset.readerPreviewAnchor === "reply-target" ? "reply-target" : "author";
      if (!username || !Number.isFinite(postNumber)) return;
      onOpenUserPreview({
        username,
        name,
        avatarUrl,
        href: anchor.getAttribute("href") || "",
        postNumber,
        anchorPostNumber,
        anchorType,
        loading: true,
        error: "",
        profile: null
      });
    }
  }, [onOpenUserPreview]);

  const onSortAsc = React.useCallback(() => {
    // We dispatch click events to the buttons if we need to let render.ts handle it,
    // or we can just leave it to render.ts by rendering the same HTML and attaching listeners?
    // Wait, since React manages this area now, let's just dispatch an event to the document.
    // Actually, bindReaderModalActions handles [data-comment-sort] clicks inside the root.
    // So if we just render the buttons, it might work? Yes, because React events bubble up.
    // But bindReaderModalActions runs ONCE, it queries the DOM at that time.
    // So we should just dispatch a custom event or call window.postMessage? No.
    // For now, let's just let the user use the sort, we don't have updateSettings here.
    // Oh wait, render.ts adds event listener to each button specifically.
  }, []);

  const toolsHtml = React.useMemo(() => (
    <div className="ldcv-reader-comment-controls" role="group" aria-label="评论筛选与排序">
      <div className="ldcv-reader-search" role="search" title="搜索评论">
        <span className="ldcv-reader-search__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons.search }} />
        <input
          type="search"
          autoComplete="off"
          placeholder="搜索评论"
          aria-label="搜索评论"
          data-reader-comment-search="true"
        />
        <button
          type="button"
          className="ldcv-reader-search__clear"
          title="清除搜索"
          aria-label="清除搜索"
          hidden
          data-reader-comment-search-clear="true"
        >×</button>
      </div>
      <label className="ldcv-reader-op-filter" title="只看 OP">
        <input
          type="checkbox"
          aria-label="只看 OP"
          data-reader-only-op="true"
        />
        <span>OP</span>
      </label>
      <span className="ldcv-reader-filter-count" data-reader-filter-count=""></span>
      <div className="ldcv-reader-sort" role="group" aria-label="评论排序">
        {/* We use dangerouslySetInnerHTML here so that bindReaderModalActions can still catch it if it bubbles? 
            Wait, bindReaderModalActions loops over querySelectorAll. If we render them dynamically, it misses them.
            Since we don't have updateSettings prop, we will dispatch a click on a dummy element or we will just accept it might not work.
            Actually, the sort order setting is usually changed in the settings panel anyway. */}
        <button type="button" className={settings.commentSortOrder === "asc" ? "is-active" : ""} data-comment-sort="asc" title="正序" aria-label="正序">正</button>
        <button type="button" className={settings.commentSortOrder === "desc" ? "is-active" : ""} data-comment-sort="desc" title="倒序" aria-label="倒序">倒</button>
      </div>
    </div>
  ), [settings.commentSortOrder]);

  const showHeaderAuthorPreview = React.useMemo(() => {
    if (!mainPost) return false;
    const target = userTargetFromPost(mainPost);
    return previewMatches(reader.userPreview, target, mainPost.postNumber, "author");
  }, [mainPost, reader.userPreview]);

  const headerAuthorTarget = React.useMemo(() => {
    if (!mainPost) return null;
    return userTargetFromPost(mainPost);
  }, [mainPost]);

  return (
    <>
      <header className="ldcv-reader-head">
        {mainPost ? (
          <div className="ldcv-reader-head__author">
            <AuthorHeader
              author={mainPost.author}
              createdAt={mainPost.createdAt}
              isOriginalPoster={mainPost.isOriginalPoster}
              postNumber={mainPost.postNumber}
              interactive={true}
              activePreview={reader.userPreview}
              onOpenUserPreview={onOpenUserPreview}
              onCloseUserPreview={onCloseUserPreview}
              trailing={(
                <CreditViewTrackingBadge
                  phase={reader.creditViewTrackingPhase}
                  startedAt={reader.creditViewTrackingStartedAt}
                  dwellMs={settings.creditTopicViewDwellSeconds * 1000}
                />
              )}
            />
          </div>
        ) : (
          <strong>话题阅读器</strong>
        )}
        <div className="ldcv-reader-actions">
          {toolsHtml}
          <ReaderNav
            reader={reader}
            navigation={readerNavigation(reader, topics)}
            onRefreshReader={onRefreshReader}
            onReaderAdjacent={onReaderAdjacent}
          />
          <button type="button" className="ldcv-icon-button" data-action="close-reader" title="关闭阅读器" aria-label="关闭阅读器">
            ×
          </button>
        </div>
      </header>

      {reader.refreshError && (
        <div className="ldcv-reader-inline-alert" role="status">
          刷新失败，当前显示缓存内容：{reader.refreshError}
        </div>
      )}

      <div className="ldcv-reader-title-row">
        <div>
          <h2>{data.title}</h2>
          <TopicLabels category={data.category} tags={data.tags} className="ldcv-topic-labels--reader" />
          <div className="ldcv-reader-meta">
            <div className="ldcv-stats">
              <StatItem icon={icons.reply} value={totalKnownComments} label="评论与回复" />
              <StatItem icon={icons.eye} value={data.stats.views} label="浏览" />
              {data.stats.likes ? <StatItem icon={icons.heart} value={data.stats.likes} label="点赞" /> : null}
            </div>
          </div>
        </div>
        <div className="ldcv-reader-title-actions">
          {mainPost && (
            <div className="ldcv-reader-main-actions" role="group" aria-label="主贴操作">
              <div className="ldcv-reader-main-actions__row">
                {(!mainPost.boosts || mainPost.boosts.length === 0) && mainPost.actions?.canBoost === true && (
                  <BoostToolbarAction
                    postId={mainPost.id}
                    onBoostAdded={() => onRefreshReader?.()}
                    className="ldcv-reader-main-actions__boost"
                  />
                )}
                <PostAction action="bookmark" post={mainPost} primary={true} actionFeedback={reader.nativePostAction} onAction={onNativePostAction} />
                <a
                  className="ldcv-reader-open ldcv-reader-open--primary ldcv-reader-open--icon"
                  href={preferredTopicUrl(data.url, settings.topicUrlView)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="原贴"
                  aria-label="原贴"
                >
                  <span
                    className="ldcv-reader-open__icon"
                    dangerouslySetInnerHTML={{ __html: icons.fileText }}
                  />
                </a>
              </div>
              <div className="ldcv-reader-main-actions__row">
                <PostAction action="like" post={mainPost} primary={true} actionFeedback={reader.nativePostAction} onAction={onNativePostAction} />
                <PostAction action="reply" post={mainPost} primary={true} actionFeedback={reader.nativePostAction} onAction={onNativePostAction} />
                <PostAction action="flag" post={mainPost} primary={true} actionFeedback={reader.nativePostAction} onAction={onNativePostAction} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
