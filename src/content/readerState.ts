import { mergeReaderPostsIntoReader } from "../discourse/api";
import type { TopicReaderData } from "../discourse/types";
import type { ReaderPostAction, ReaderState } from "../ui/readerTypes";

export function emptyReaderState(): ReaderState {
  return {
    topicId: null,
    data: null,
    loading: false,
    refreshing: false,
    loadingMore: false,
    loadMoreError: "",
    refreshError: "",
    freshPostNumbers: [],
    error: "",
    imageViewer: null,
    userPreview: null,
    nativePostAction: null,
    pollVote: null,
    creditViewTrackingPhase: null,
    creditViewTrackingStartedAt: null,
  };
}

export function preserveCreditViewTrackingState(previous: ReaderState, next: ReaderState): ReaderState {
  const preservePhase = !Object.prototype.hasOwnProperty.call(next, "creditViewTrackingPhase");
  const preserveStartedAt = !Object.prototype.hasOwnProperty.call(next, "creditViewTrackingStartedAt");

  return {
    ...next,
    creditViewTrackingPhase: preservePhase
      ? previous.creditViewTrackingPhase ?? null
      : next.creditViewTrackingPhase ?? null,
    creditViewTrackingStartedAt: preserveStartedAt
      ? previous.creditViewTrackingStartedAt ?? null
      : next.creditViewTrackingStartedAt ?? null,
  };
}

export function mergeReaderRefreshBase(
  freshData: TopicReaderData,
  previousData: TopicReaderData
): TopicReaderData {
  const byPostNumber = new Map(freshData.posts.map((post) => [post.postNumber, post]));
  const visiblePostIds = new Set(freshData.postStream);
  return mergeReaderPostsIntoReader(
    freshData,
    previousData.posts.filter(
      (post) => !byPostNumber.has(post.postNumber) && (!visiblePostIds.size || visiblePostIds.has(post.id))
    )
  );
}

export function missingReaderPostIdsForRefresh(
  freshData: TopicReaderData,
  previousData: TopicReaderData
): number[] {
  const loadedIds = new Set(freshData.loadedPostIds);
  const missingIds = freshData.postStream.filter((id) => !loadedIds.has(id));
  if (!missingIds.length) {
    return [];
  }

  if (!previousData.hasMorePosts) {
    return missingIds;
  }

  const newPostCount = Math.max(0, freshData.stats.posts - previousData.stats.posts);
  return newPostCount > 0 ? missingIds.slice(-newPostCount) : [];
}

export function mergeSubmittedReaderReply(
  previousData: TopicReaderData,
  freshData: TopicReaderData,
  submittedPostNumber: number | null
): { data: TopicReaderData; freshPostNumbers: number[] } {
  const previousPostNumbers = new Set(previousData.posts.map((post) => post.postNumber));
  const freshReplies = freshData.posts.filter((post) => {
    if (post.isOriginalPost || previousPostNumbers.has(post.postNumber)) {
      return false;
    }
    return submittedPostNumber === null || post.postNumber === submittedPostNumber;
  });

  if (!freshReplies.length) {
    return {
      data: previousData,
      freshPostNumbers: []
    };
  }

  const base: TopicReaderData = {
    ...previousData,
    stats: {
      posts: Math.max(previousData.stats.posts, freshData.stats.posts),
      views: Math.max(previousData.stats.views, freshData.stats.views),
      likes: Math.max(previousData.stats.likes, freshData.stats.likes)
    },
    postStream: freshData.postStream.length ? freshData.postStream : previousData.postStream,
    hasMorePosts: freshData.hasMorePosts || previousData.hasMorePosts
  };
  const data = mergeReaderPostsIntoReader(base, freshReplies);
  return {
    data,
    freshPostNumbers: freshReplies.map((post) => post.postNumber)
  };
}

export function applyConfirmedReaderPostAction(
  reader: TopicReaderData,
  postNumber: number,
  action: ReaderPostAction,
  acted = true
): TopicReaderData {
  if (action !== "like" && action !== "bookmark") {
    return reader;
  }

  let changed = false;
  const posts = reader.posts.map((post) => {
    if (post.postNumber !== postNumber) {
      return post;
    }

    const nextActions = {
      ...post.actions,
      ...(action === "like" ? { liked: acted, canLike: true } : {}),
      ...(action === "bookmark" ? { bookmarked: acted, canBookmark: true } : {})
    };
    changed ||= nextActions.liked !== post.actions.liked || nextActions.bookmarked !== post.actions.bookmarked;
    return {
      ...post,
      actions: nextActions
    };
  });

  return changed ? mergeReaderPostsIntoReader(reader, posts) : reader;
}
