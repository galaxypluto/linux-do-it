export type DiscourseListResponse = {
  topic_list?: {
    topics?: DiscourseTopic[];
    more_topics_url?: string;
  };
  users?: DiscourseUser[];
  categories?: DiscourseCategory[];
  category_list?: {
    categories?: DiscourseCategory[];
  };
};

export type DiscoursePostResponse = {
  id?: unknown;
  cooked?: unknown;
  polls?: unknown[];
  username?: unknown;
  name?: unknown;
  user_id?: unknown;
  avatar_template?: unknown;
  created_at?: unknown;
  post_number?: unknown;
  reply_to_post_number?: unknown;
  reads?: unknown;
  like_count?: unknown;
  reply_count?: unknown;
  actions_summary?: Array<{
    id?: unknown;
    count?: unknown;
    acted?: unknown;
    can_act?: unknown;
    can_undo?: unknown;
    hidden?: unknown;
    name_key?: unknown;
  }>;
  bookmarked?: unknown;
  bookmark_id?: unknown;
  can_bookmark?: unknown;
};

export type DiscourseTopicResponse = {
  id?: number;
  title?: unknown;
  fancy_title?: unknown;
  slug?: unknown;
  created_at?: unknown;
  posts_count?: unknown;
  views?: unknown;
  like_count?: unknown;
  tags?: unknown[];
  draft_key?: unknown;
  draft_sequence?: unknown;
  bookmarked?: unknown;
  details?: {
    can_create_post?: unknown;
  };
  bookmarks?: Array<{
    bookmarkable_id?: unknown;
    bookmarkable_type?: unknown;
    post_number?: unknown;
  }>;
  post_stream?: {
    stream?: unknown[];
    posts?: DiscoursePostResponse[];
  };
  posts?: DiscoursePostResponse[];
};

export type DiscourseTopic = {
  id: number;
  title?: string;
  fancy_title?: string;
  slug?: string;
  excerpt?: string;
  escaped_excerpt?: string;
  image_url?: string;
  thumbnails?: Array<{
    url?: string;
    width?: number;
    height?: number;
    max_width?: number;
  }>;
  category_id?: number;
  tags?: unknown[];
  posts_count?: number;
  reply_count?: number;
  views?: number;
  like_count?: number;
  score?: number;
  highest_post_number?: number;
  last_read_post_number?: number;
  unread?: number;
  new_posts?: number;
  unread_posts?: number;
  created_at?: string;
  bumped_at?: string;
  last_posted_at?: string;
  pinned?: boolean;
  closed?: boolean;
  archived?: boolean;
  bookmarked?: boolean;
  unseen?: boolean;
  posters?: Array<{
    user_id?: number;
    extras?: string;
    description?: string;
  }>;
};

export type DiscourseUser = {
  id: number;
  username?: unknown;
  name?: unknown;
  avatar_template?: unknown;
};

export type DiscourseUserProfileResponse = {
  user?: {
    id?: unknown;
    username?: unknown;
    name?: unknown;
    avatar_template?: unknown;
    created_at?: unknown;
    can_send_private_message_to_user?: unknown;
    can_send_private_message?: unknown;
  };
};

export type DiscourseCategory = {
  id: number;
  name?: unknown;
  slug?: unknown;
  color?: unknown;
  text_color?: unknown;
  parent_category_id?: number;
};

export type TopicCardData = {
  id: number;
  title: string;
  url: string;
  slug: string;
  excerpt: string;
  thumbnailUrl: string;
  category?: {
    id: number;
    name: string;
    parentName: string;
    color: string;
    textColor: string;
  };
  tags: string[];
  stats: {
    replies: number;
    views: number;
    likes: number;
    score: number;
  };
  dates: {
    createdAt: string;
    activityAt: string;
  };
  flags: {
    pinned: boolean;
    closed: boolean;
    archived: boolean;
    bookmarked: boolean;
    unseen: boolean;
    read?: boolean;
  };
  posters: Array<{
    id: number;
    username: string;
    name: string;
    avatarUrl: string;
    description: string;
    isOriginalPoster: boolean;
  }>;
};

export type TopicListData = {
  endpoint: string;
  topics: TopicCardData[];
  moreTopicsUrl: string;
};

export type TopicReaderAuthor = {
  id: number | null;
  username: string;
  name: string;
  avatarUrl: string;
};

export type TopicReaderPost = {
  id: number;
  postNumber: number;
  replyToPostNumber: number | null;
  author: TopicReaderAuthor;
  createdAt: string;
  html: string;
  stats: {
    likes: number;
    reads: number;
    replies: number;
  };
  actions: {
    canReply: boolean | null;
    canLike: boolean | null;
    liked: boolean | null;
    canBookmark: boolean | null;
    bookmarked: boolean | null;
  };
  url: string;
  isOriginalPost: boolean;
  isOriginalPoster: boolean;
};

export type TopicReplyNode = {
  post: TopicReaderPost;
  children: TopicReplyNode[];
  depth: number;
};

export type TopicReaderData = {
  id: number;
  title: string;
  url: string;
  slug: string;
  stats: {
    posts: number;
    views: number;
    likes: number;
  };
  actions: {
    canReply: boolean | null;
    draftKey: string;
    draftSequence: number;
  };
  tags: string[];
  category?: TopicCardData['category'];
  opAuthor: TopicReaderAuthor | null;
  posts: TopicReaderPost[];
  tree: TopicReplyNode[];
  postStream: number[];
  loadedPostIds: number[];
  hasMorePosts: boolean;
};

export type ReaderUserProfileData = {
  id: number | null;
  username: string;
  name: string;
  avatarUrl: string;
  joinedAt: string;
  profileUrl: string;
  messageUrl: string;
  canMessage: boolean;
};

export type DiscourseSearchResponse = {
  topics?: DiscourseTopic[];
  posts?: unknown[];
  users?: DiscourseUser[];
  categories?: DiscourseCategory[];
  grouped_search_result?: {
    more_posts?: boolean | null;
    more_full_page_results?: boolean | null;
  };
};
