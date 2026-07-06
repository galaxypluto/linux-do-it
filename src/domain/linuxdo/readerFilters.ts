import type { CommentSortOrder } from '../settings';
import type { TopicReaderData, TopicReaderPost } from './types';

export type ReaderPostFilterOptions = {
  sortOrder: CommentSortOrder;
  query?: string;
  opOnly?: boolean;
};

export function visibleReaderPosts(
  reader: TopicReaderData,
  options: ReaderPostFilterOptions,
): TopicReaderPost[] {
  const query = normalizeQuery(options.query);
  const [originalPost, ...comments] = reader.posts;
  const sortedComments = [...comments].sort((left, right) =>
    options.sortOrder === 'desc'
      ? right.postNumber - left.postNumber
      : left.postNumber - right.postNumber,
  );

  return [originalPost, ...sortedComments]
    .filter((post): post is TopicReaderPost => Boolean(post))
    .filter((post) => (options.opOnly ? post.isOriginalPoster || post.isOriginalPost : true))
    .filter((post) => (query ? postSearchText(post).includes(query) : true));
}

function postSearchText(post: TopicReaderPost): string {
  return normalizeQuery(
    [
      post.author.name,
      post.author.username,
      post.html.replace(/<[^>]*>/g, ' '),
      post.postNumber,
    ].join(' '),
  );
}

function normalizeQuery(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

