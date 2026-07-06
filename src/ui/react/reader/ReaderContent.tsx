import * as React from "react";
import type { TopicCardData, TopicReaderPost } from "../../../discourse/types";
import type { ReaderState, ReaderPostAction } from "../../readerTypes";
import type { ReaderTemplateSettings } from "../../readerTemplates";
import { readerLoaderTemplate } from "../../readerTemplates";
import { TopicHeader } from "./TopicHeader";
import { CommentList } from "./CommentList";
import { PostContent, type ReaderImageViewerState } from "../components/PostContent";
import { ReaderLoadMore } from "../components/ReaderLoadMore";
import { IncompleteNotice } from "../components/IncompleteNotice";
import { escapeAttribute, escapeHtml } from "../../html";
import { preferredTopicUrl } from "../../readerTemplates";
import { sortReplyNodes } from "../../replies";
import {
  READER_AUTO_LOAD_MIN_SCROLL_TOP,
  shouldTriggerReaderAutoLoad,
} from "../../readerAutoLoad";

// Legacy imports that will be gradually replaced
import {
  readerNavTemplate,
  mainPostTemplate,
  incompleteNoticeTemplate,
  readerLoadMoreTemplate
} from "../../readerTemplates";

type ReaderContentProps = {
  reader: ReaderState;
  topics: TopicCardData[];
  settings: ReaderTemplateSettings;
  variant: "pane" | "modal";
  onClose: () => void;
  onOpenUserPreview?: (previewTarget: any) => void;
  onCloseUserPreview?: () => void;
  onRefreshReader?: () => void;
  onReaderAdjacent?: (direction: 1 | -1) => void;
  onNativePostAction?: (action: ReaderPostAction, postNumber: number) => void;
  onOpenReaderImage?: (image: ReaderImageViewerState, origin: DOMRect) => void;
  onLoadMoreReaderPosts?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

export function collectFreshAnimationPostNumbers(
  freshPostNumbers: readonly number[],
  alreadyAnimatedPostNumbers: ReadonlySet<number>
): Set<number> {
  return new Set(freshPostNumbers.filter((postNumber) => !alreadyAnimatedPostNumbers.has(postNumber)));
}

type FreshPostArrowState = {
  upTarget: number | null;
  downTarget: number | null;
  upCount: number;
  downCount: number;
};

function isSameArrowState(a: FreshPostArrowState, b: FreshPostArrowState): boolean {
  return (
    a.upTarget === b.upTarget &&
    a.downTarget === b.downTarget &&
    a.upCount === b.upCount &&
    a.downCount === b.downCount
  );
}

const emptyFreshPostArrowState: FreshPostArrowState = {
  upTarget: null,
  downTarget: null,
  upCount: 0,
  downCount: 0,
};

export function ReaderContent({
  reader,
  topics,
  settings,
  variant,
  onClose,
  onOpenUserPreview,
  onCloseUserPreview,
  onRefreshReader,
  onReaderAdjacent,
  onNativePostAction,
  onOpenReaderImage,
  onLoadMoreReaderPosts,
  scrollRef
}: ReaderContentProps): React.ReactElement | null {
  const data = reader.data;

  // Render Idle state
  if (!reader.topicId) {
    return (
      <article className="ldcv-reader-article ldcv-reader-article--status ldcv-reader-article--idle" data-reader-variant={variant}>
        <header className="ldcv-reader-head">
          <strong>选择一个帖子开始阅读</strong>
        </header>
        <div className="ldcv-reader-status-body" dangerouslySetInnerHTML={{ __html: readerLoaderTemplate({ mode: "idle" }) }} />
      </article>
    );
  }

  // Render Error state
  if (reader.error && !data) {
    const topic = topics.find((item) => item.id === reader.topicId);
    return (
      <article className="ldcv-reader-article ldcv-reader-article--status" data-reader-variant={variant} data-reader-topic-id={reader.topicId}>
        <header className="ldcv-reader-head">
          <strong>讨论读取失败</strong>
          <div className="ldcv-reader-actions">
            <button type="button" className="ldcv-icon-button" onClick={onClose} title="关闭阅读器" aria-label="关闭阅读器">×</button>
          </div>
        </header>
        <div className="ldcv-reader-status-body">
          <div className="ldcv-reader-error">
            <strong>没有读到这个讨论</strong>
            <p>{reader.error}</p>
            <div className="ldcv-reader-error__actions">
              <button type="button" className="ldcv-reader-retry" data-action="retry-reader">重试</button>
              {topic && (
                <a className="ldcv-reader-open" href={preferredTopicUrl(topic.url, settings.topicUrlView)} target="_blank" rel="noopener noreferrer">
                  原贴
                </a>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // Render Loading state
  if (reader.loading || !data) {
    return (
      <article className="ldcv-reader-article ldcv-reader-article--status" data-reader-variant={variant} data-reader-topic-id={reader.topicId}>
        <header className="ldcv-reader-head">
          <strong>正在读取完整讨论</strong>
          <div className="ldcv-reader-actions">
            <button type="button" className="ldcv-icon-button" onClick={onClose} title="关闭阅读器" aria-label="关闭阅读器">×</button>
          </div>
        </header>
        <div className="ldcv-reader-status-body" dangerouslySetInnerHTML={{ __html: readerLoaderTemplate({ mode: "loading" }) }} />
      </article>
    );
  }

  // Render Loaded Content
  const mainPost = data.posts.find((post) => post.isOriginalPost) || data.posts[0];
  const postIndex = new Map(data.posts.map((post) => [post.postNumber, post]));
  
  // Sort tree and fresh posts
  const sortedTree = sortReplyNodes(data.tree, settings.commentSortOrder);
  
  const totalKnownPosts = data.postStream.length || data.stats.posts;
  const totalKnownComments = Math.max(totalKnownPosts - 1, 0);
  const commentCount = Math.max(data.posts.length - (mainPost ? 1 : 0), 0);
  const missingCount = Math.max(totalKnownPosts - data.posts.length, 0);
  const freshPostNumbers = React.useMemo(() => new Set(reader.freshPostNumbers), [reader.freshPostNumbers]);
  const animatedFreshPostNumbersRef = React.useRef<Set<number>>(new Set());
  const animatedFreshTopicIdRef = React.useRef<number | null>(null);

  if (animatedFreshTopicIdRef.current !== reader.topicId) {
    animatedFreshTopicIdRef.current = reader.topicId;
    animatedFreshPostNumbersRef.current = new Set();
  }

  const animateFreshPostNumbers = React.useMemo(
    () => collectFreshAnimationPostNumbers(reader.freshPostNumbers, animatedFreshPostNumbersRef.current),
    [reader.freshPostNumbers]
  );

  React.useEffect(() => {
    for (const postNumber of reader.freshPostNumbers) {
      animatedFreshPostNumbersRef.current.add(postNumber);
    }
  }, [reader.freshPostNumbers]);

  const [scrollElement, setScrollElement] = React.useState<HTMLDivElement | null>(null);
  const handleScrollRef = React.useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
    if (scrollRef) {
      // scrollRef from ReaderContentProps
      (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [scrollRef]);

  const [arrowState, setArrowState] = React.useState<FreshPostArrowState>(emptyFreshPostArrowState);

  React.useEffect(() => {
    if (scrollElement) {
      scrollElement.scrollTop = 0;
    }
  }, [scrollElement, reader.topicId]);

  React.useEffect(() => {
    if (!scrollElement) return;

    let rAFTimer: number;
    let disposed = false;

    const computeArrows = () => {
      if (disposed) {
        return;
      }

      if (reader.freshPostNumbers.length === 0) {
        setArrowState((prev) => (isSameArrowState(prev, emptyFreshPostArrowState) ? prev : emptyFreshPostArrowState));
        return;
      }

      const scrollerRect = scrollElement.getBoundingClientRect();
      const clientHeight = scrollElement.clientHeight;
      const rootNode = scrollElement.getRootNode() as ShadowRoot | Document;

      let minRelativeTop = Infinity;
      let maxRelativeTop = -Infinity;
      let minPostNumber: number | null = null;
      let maxPostNumber: number | null = null;
      let currentUpCount = 0;
      let currentDownCount = 0;

      for (const postNumber of reader.freshPostNumbers) {
        const el = rootNode.getElementById(`ldcv-post-${postNumber}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const relativeTop = rect.top - scrollerRect.top;

          if (relativeTop < -10) {
            currentUpCount++;
            if (relativeTop < minRelativeTop) {
              minRelativeTop = relativeTop;
              minPostNumber = postNumber;
            }
          }
          if (relativeTop > clientHeight - 10) {
            currentDownCount++;
            if (relativeTop > maxRelativeTop) {
              maxRelativeTop = relativeTop;
              maxPostNumber = postNumber;
            }
          }
        }
      }

      const next: FreshPostArrowState = {
        upTarget: minPostNumber,
        downTarget: maxPostNumber,
        upCount: currentUpCount,
        downCount: currentDownCount,
      };
      setArrowState((prev) => (isSameArrowState(prev, next) ? prev : next));
    };

    const scheduleCompute = () => {
      cancelAnimationFrame(rAFTimer);
      rAFTimer = requestAnimationFrame(computeArrows);
    };

    scrollElement.addEventListener("scroll", scheduleCompute, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleCompute) : null;
    resizeObserver?.observe(scrollElement);

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(scheduleCompute)
        : null;
    mutationObserver?.observe(scrollElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });

    scheduleCompute();

    return () => {
      disposed = true;
      scrollElement.removeEventListener("scroll", scheduleCompute);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      cancelAnimationFrame(rAFTimer);
    };
  }, [
    scrollElement,
    reader.topicId,
    reader.freshPostNumbers,
    reader.loadingMore,
    data.posts.length,
  ]);

  const handleScrollToTarget = (postNumber: number) => {
    if (!scrollElement) return;
    const rootNode = scrollElement.getRootNode() as ShadowRoot | Document;
    const el = rootNode.getElementById(`ldcv-post-${postNumber}`);
    if (el) {
      const scrollerRect = scrollElement.getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      const nextTop = Math.max(0, scrollElement.scrollTop + targetRect.top - scrollerRect.top - 16);
      if (typeof scrollElement.scrollTo === "function") {
        scrollElement.scrollTo({
          top: nextTop,
          behavior: "smooth"
        });
      } else {
        scrollElement.scrollTop = nextTop;
      }
    }
  };

  const pointerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    return () => {
      if (pointerTimerRef.current) {
        clearTimeout(pointerTimerRef.current);
      }
    };
  }, []);

  const getClosestTarget = React.useCallback((direction: "up" | "down") => {
    if (!scrollElement || reader.freshPostNumbers.length === 0) return null;
    const scrollerRect = scrollElement.getBoundingClientRect();
    const rootNode = scrollElement.getRootNode() as ShadowRoot | Document;
    
    let closestTarget: number | null = null;
    let minDiff = Infinity;
    
    for (const postNumber of reader.freshPostNumbers) {
      const el = rootNode.getElementById(`ldcv-post-${postNumber}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const relativeTop = rect.top - scrollerRect.top;
        
        if (direction === "up" && relativeTop < -10) {
          const diff = Math.abs(relativeTop);
          if (diff < minDiff) {
            minDiff = diff;
            closestTarget = postNumber;
          }
        } else if (direction === "down" && relativeTop > scrollElement.clientHeight - 10) {
          const diff = relativeTop - scrollElement.clientHeight;
          if (diff < minDiff) {
            minDiff = diff;
            closestTarget = postNumber;
          }
        }
      }
    }
    return closestTarget;
  }, [scrollElement, reader.freshPostNumbers]);

  const handlePressStart = (absoluteTarget: number) => {
    didLongPressRef.current = false;
    if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
    
    pointerTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      handleScrollToTarget(absoluteTarget);
    }, 400); // 400ms for hold
  };

  const handlePressEndOrCancel = () => {
    if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
  };

  const handleClick = (direction: "up" | "down", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (pointerTimerRef.current) clearTimeout(pointerTimerRef.current);
    
    if (didLongPressRef.current) {
      // Long press already handled, ignore click
      didLongPressRef.current = false;
      return;
    }
    
    // Short click: jump to closest
    const closestTarget = getClosestTarget(direction);
    if (closestTarget !== null) {
      handleScrollToTarget(closestTarget);
    }
  };

  return (
    <article className="ldcv-reader-article" data-reader-variant={variant} data-reader-topic-id={data.id}>
      <TopicHeader
        data={data as any}
        mainPost={mainPost}
        reader={reader}
        topics={topics}
        settings={settings}
        onClose={onClose}
        onOpenUserPreview={onOpenUserPreview}
        onCloseUserPreview={onCloseUserPreview}
        onRefreshReader={onRefreshReader}
        onReaderAdjacent={onReaderAdjacent}
        onNativePostAction={onNativePostAction}
      />

      <div className="ldcv-reader-scroll-wrapper" style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="ldcv-reader-scroll" ref={handleScrollRef} tabIndex={-1}>
          {mainPost ? (
            <div className="ldcv-reader-main" id={`ldcv-post-${mainPost.postNumber}`}>
              <div className="ldcv-reader-post__toolbar">
                <span>主贴</span>
              </div>
              <PostContent post={mainPost} onOpenReaderImage={onOpenReaderImage} />
            </div>
          ) : null}

        <section className="ldcv-reader-thread">
          <header className="ldcv-reader-thread__head">
            <div className="ldcv-reader-thread__summary">
              <strong>评论 {totalKnownPosts ? <span className="ldcv-reader-thread__progress">({commentCount} / {totalKnownComments})</span> : `(${commentCount})`}</strong>
              <span>{settings.commentSortOrder === "desc" ? "最新在前" : "最早在前"}</span>
            </div>
            {missingCount > 0 && !data.hasMorePosts && <IncompleteNotice url={data.url} count={missingCount} topicUrlView={settings.topicUrlView} />}
          </header>

          <CommentList
            sortedTree={sortedTree}
            postIndex={postIndex}
            reader={reader}
            settings={settings}
            activePreview={reader.userPreview}
            actionFeedback={reader.nativePostAction}
            freshPostNumbers={freshPostNumbers}
            animatePostNumbers={animateFreshPostNumbers}
            scrollElement={scrollElement}
            onOpenUserPreview={onOpenUserPreview}
            onCloseUserPreview={onCloseUserPreview}
            onNativePostAction={onNativePostAction}
            onOpenReaderImage={onOpenReaderImage}
          />

          {/* Auto-load sentinel: when this enters the viewport and there are
              more posts to load, trigger onLoadMoreReaderPosts automatically. */}
          {data.hasMorePosts && onLoadMoreReaderPosts && settings.autoLoadReaderComments && (
            <ReaderAutoLoadTrigger
              key={reader.topicId}
              loadingMore={reader.loadingMore}
              scrollElement={scrollElement}
              onLoadMore={onLoadMoreReaderPosts}
            />
          )}

          <ReaderLoadMore
            reader={reader}
            missingCount={missingCount}
            variant={variant}
            settings={settings}
            onLoadMoreReaderPosts={onLoadMoreReaderPosts}
          />
        </section>
      </div>

      {arrowState.upTarget !== null && arrowState.upCount > 0 && (
        <button
          type="button"
          className="ldcv-reader-new-posts-indicator ldcv-reader-new-posts-indicator--up"
          onPointerDown={() => handlePressStart(arrowState.upTarget!)}
          onPointerUp={handlePressEndOrCancel}
          onPointerLeave={handlePressEndOrCancel}
          onPointerCancel={handlePressEndOrCancel}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => handleClick("up", e)}
          title="长按跳转到最上方新回复，点击跳转到最近的新回复"
          aria-label="上方新回复"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ldcv-reader-new-posts-indicator__icon">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          <span className="ldcv-reader-indicator-count">{arrowState.upCount > 99 ? "99+" : arrowState.upCount}</span>
        </button>
      )}

      {arrowState.downTarget !== null && arrowState.downCount > 0 && (
        <button
          type="button"
          className="ldcv-reader-new-posts-indicator ldcv-reader-new-posts-indicator--down"
          onPointerDown={() => handlePressStart(arrowState.downTarget!)}
          onPointerUp={handlePressEndOrCancel}
          onPointerLeave={handlePressEndOrCancel}
          onPointerCancel={handlePressEndOrCancel}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => handleClick("down", e)}
          title="长按跳转到最下方新回复，点击跳转到最近的新回复"
          aria-label="下方新回复"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ldcv-reader-new-posts-indicator__icon">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span className="ldcv-reader-indicator-count">{arrowState.downCount > 99 ? "99+" : arrowState.downCount}</span>
        </button>
      )}
      </div>
    </article>
  );
}

/**
 * 监听 Reader 滚动容器：用户滚近底部时触发 loadMore。
 * 使用 scroll/resize 检测，避免 IntersectionObserver 在贴底时不重复回调。
 */
function ReaderAutoLoadTrigger({
  loadingMore,
  scrollElement,
  onLoadMore,
}: {
  loadingMore: boolean;
  scrollElement: HTMLDivElement | null;
  onLoadMore: () => void;
}): null {
  const hasScrolledRef = React.useRef(false);
  const lastTriggeredAtRef = React.useRef(0);
  const onLoadMoreRef = React.useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const tryAutoLoad = React.useCallback(() => {
    if (!scrollElement) {
      return;
    }

    if (
      !shouldTriggerReaderAutoLoad({
        scrollHeight: scrollElement.scrollHeight,
        scrollTop: scrollElement.scrollTop,
        clientHeight: scrollElement.clientHeight,
        hasScrolled: hasScrolledRef.current,
        loadingMore,
        lastTriggeredAt: lastTriggeredAtRef.current,
      })
    ) {
      return;
    }

    lastTriggeredAtRef.current = Date.now();
    onLoadMoreRef.current();
  }, [loadingMore, scrollElement]);

  React.useEffect(() => {
    if (!scrollElement) {
      return;
    }

    const handleScroll = (): void => {
      if (scrollElement.scrollTop > READER_AUTO_LOAD_MIN_SCROLL_TOP) {
        hasScrolledRef.current = true;
      }
      tryAutoLoad();
    };

    scrollElement.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => tryAutoLoad()) : null;
    resizeObserver?.observe(scrollElement);

    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
    };
  }, [scrollElement, tryAutoLoad]);

  React.useEffect(() => {
    if (!loadingMore) {
      window.requestAnimationFrame(() => tryAutoLoad());
    }
  }, [loadingMore, tryAutoLoad]);

  return null;
}
