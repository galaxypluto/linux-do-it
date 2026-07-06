import { BrowserSessionCacheAdapter } from '../adapters/browser/BrowserSessionCacheAdapter';
import { FetchHttpAdapter } from '../adapters/browser/FetchHttpAdapter';
import { ChromeSettingsStorageAdapter } from '../adapters/chrome/ChromeSettingsStorageAdapter';
import { LinuxDoApiService } from '../application/services/LinuxDoApiService';
import { SettingsService } from '../application/services/SettingsService';
import type { ExtensionSettings } from '../domain/settings';
import type {
  ReaderUserProfileData,
  TopicCardData,
  TopicListData,
  TopicReaderData,
  TopicReaderPost,
} from '../domain/linuxdo/types';
import { visibleReaderPosts } from '../domain/linuxdo/readerFilters';
import {
  detectNewTopics,
  mergeAppendTopicList,
  mergePendingTopics,
  newestTopicCreatedAtMs,
} from '../domain/linuxdo/topicListState';
import { linuxDoAbsoluteUrl, linuxDoPreferredTopicUrl } from '../domain/linuxdo/urls';
import {
  ensurePageBridge,
  requestNativePostAction,
  requestNativePrivateMessage,
  type NativePostAction,
  type NativePostActionResult,
} from './nativeBridge';

const HOST_ID = 'linuxdo-reader-content-root';

type MountOptions = {
  endpoint: string;
  title: string;
};

type AppState = {
  settings: ExtensionSettings;
  list: TopicListData | null;
  loadingList: boolean;
  listError: string;
  reader: TopicReaderData | null;
  readerTopic: TopicCardData | null;
  loadingReader: boolean;
  readerError: string;
  loadingMorePosts: boolean;
  readerQuery: string;
  readerOpOnly: boolean;
  imageViewer: ReaderImageViewerState | null;
  userPreview: ReaderUserPreviewState | null;
  nativeFeedback: NativeFeedbackState | null;
  pendingTopics: TopicCardData[];
  newestTopicCreatedAtMs: number;
};

type ReaderImageViewerState = {
  items: ReaderImageViewerItem[];
  index: number;
  scale: number;
  rotation: number;
};

type ReaderImageViewerItem = {
  src: string;
  alt: string;
  originalUrl: string;
};

type ReaderUserPreviewState = {
  username: string;
  postNumber: number;
  loading: boolean;
  error: string;
  profile: ReaderUserProfileData | null;
};

type NativeFeedbackState = {
  postNumber: number;
  action: NativePostAction | 'private-message';
  status: 'pending' | NativePostActionResult['status'];
  message: string;
};

export async function mountLinuxDoCardView(options: MountOptions): Promise<void> {
  if (!options.endpoint) {
    unmountLinuxDoCardView();
    return;
  }

  const settingsService = new SettingsService(new ChromeSettingsStorageAdapter());
  const settings = await settingsService.load();
  if (!settings.enabled) {
    unmountLinuxDoCardView();
    await chrome.storage.local.set({
      'debug:lastContentReader': {
        mounted: false,
        reason: 'disabled',
        endpoint: options.endpoint,
        updatedAt: new Date().toISOString(),
      },
    });
    return;
  }

  const existing = document.getElementById(HOST_ID);
  const host = existing ?? document.createElement('section');
  host.id = HOST_ID;
  host.setAttribute('aria-label', 'Linux.do Reader content view');
  if (!host.shadowRoot) {
    host.attachShadow({ mode: 'open' });
  }

  const target = document.querySelector('#main-outlet') ?? document.body;
  if (!existing) {
    target.prepend(host);
  }

  const app = new LinuxDoCardViewApp(host.shadowRoot!, options, settings, settingsService);
  await app.start();
}

export function unmountLinuxDoCardView(): void {
  document.getElementById(HOST_ID)?.remove();
}

class LinuxDoCardViewApp {
  private readonly api = new LinuxDoApiService({
    http: new FetchHttpAdapter(),
    cache: new BrowserSessionCacheAdapter(),
    origin: window.location.origin,
  });
  private state: AppState;
  private pollTimer: number | undefined;

  constructor(
    private readonly root: ShadowRoot,
    private readonly options: MountOptions,
    settings: ExtensionSettings,
    private readonly settingsService: SettingsService,
  ) {
    this.state = {
      settings,
      list: null,
      loadingList: false,
      listError: '',
      reader: null,
      readerTopic: null,
      loadingReader: false,
      readerError: '',
      loadingMorePosts: false,
      readerQuery: '',
      readerOpOnly: false,
      imageViewer: null,
      userPreview: null,
      nativeFeedback: null,
      pendingTopics: [],
      newestTopicCreatedAtMs: 0,
    };
  }

  async start(): Promise<void> {
    ensurePageBridge();
    this.render();
    await this.loadList();
  }

  private async loadList(): Promise<void> {
    this.state = {
      ...this.state,
      loadingList: true,
      listError: '',
      reader: null,
      readerTopic: null,
      readerError: '',
      readerQuery: '',
      readerOpOnly: false,
      imageViewer: null,
      userPreview: null,
      nativeFeedback: null,
    };
    this.render();

    try {
      const list = await this.api.fetchTopicList(this.options.endpoint);
      this.state = {
        ...this.state,
        list,
        loadingList: false,
        pendingTopics: [],
        newestTopicCreatedAtMs: newestTopicCreatedAtMs(list.topics),
      };
      this.configurePolling();
      await this.writeDebug('list-loaded');
    } catch (error) {
      this.state = {
        ...this.state,
        loadingList: false,
        listError: errorMessage(error),
      };
      await this.writeDebug('list-error');
    }
    this.render();
  }

  private async loadMoreTopics(): Promise<void> {
    const list = this.state.list;
    if (!list?.moreTopicsUrl || this.state.loadingList) {
      return;
    }

    this.state = { ...this.state, loadingList: true, listError: '' };
    this.render();

    try {
      const endpoint = this.api.endpointFromMoreTopicsUrl(list.moreTopicsUrl);
      const next = await this.api.fetchTopicList(endpoint);
      this.state = {
        ...this.state,
        list: mergeAppendTopicList(list, next),
        loadingList: false,
      };
      await this.writeDebug('more-topics-loaded');
    } catch (error) {
      this.state = {
        ...this.state,
        loadingList: false,
        listError: errorMessage(error),
      };
      await this.writeDebug('more-topics-error');
    }
    this.render();
  }

  private async openReader(topic: TopicCardData): Promise<void> {
    const cached = this.api.getCachedTopicReader(topic.id);
    this.state = {
      ...this.state,
      reader: cached,
      readerTopic: topic,
      loadingReader: true,
      readerError: '',
      readerQuery: '',
      readerOpOnly: false,
      imageViewer: null,
      userPreview: null,
      nativeFeedback: null,
    };
    this.render();

    try {
      const reader = await this.api.fetchTopicReader(topic, undefined, { skipCache: Boolean(cached) });
      this.state = {
        ...this.state,
        reader,
        loadingReader: false,
      };
      await this.writeDebug('reader-loaded');
    } catch (error) {
      this.state = {
        ...this.state,
        loadingReader: false,
        readerError: errorMessage(error),
      };
      await this.writeDebug('reader-error');
    }
    this.render();
  }

  private async loadMorePosts(): Promise<void> {
    const reader = this.state.reader;
    if (!reader || this.state.loadingMorePosts) {
      return;
    }

    this.state = { ...this.state, loadingMorePosts: true, readerError: '' };
    this.render();

    try {
      const next = await this.api.fetchMoreReaderPosts(reader, this.state.settings.readerPostBatchSize);
      this.state = {
        ...this.state,
        reader: next,
        loadingMorePosts: false,
      };
      await this.writeDebug('reader-more-posts-loaded');
    } catch (error) {
      this.state = {
        ...this.state,
        loadingMorePosts: false,
        readerError: errorMessage(error),
      };
      await this.writeDebug('reader-more-posts-error');
    }
    this.render();
  }

  private async updateSettings(patch: Partial<ExtensionSettings>): Promise<void> {
    const settings = await this.settingsService.save({
      ...this.state.settings,
      ...patch,
    });
    this.state = { ...this.state, settings };
    this.configurePolling();
    this.render();
    await this.writeDebug('settings-updated');
  }

  private configurePolling(): void {
    if (this.pollTimer !== undefined) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    if (!this.state.settings.newTopicNoticeEnabled || !this.state.list) {
      return;
    }

    this.pollTimer = window.setInterval(() => {
      void this.checkNewTopics();
    }, this.state.settings.newTopicCheckIntervalSeconds * 1000);
  }

  private async checkNewTopics(): Promise<void> {
    const list = this.state.list;
    if (!list || this.state.loadingList) {
      return;
    }

    try {
      const latest = await this.api.fetchTopicList(this.options.endpoint);
      const newTopics = detectNewTopics(list, latest, this.state.pendingTopics, this.state.newestTopicCreatedAtMs);
      if (!newTopics.length) {
        return;
      }
      this.state = {
        ...this.state,
        pendingTopics: [...newTopics, ...this.state.pendingTopics],
      };
      await this.writeDebug('new-topics-detected');
      this.render();
    } catch {
      await this.writeDebug('new-topic-check-failed');
    }
  }

  private applyPendingTopics(): void {
    const list = this.state.list;
    if (!list || !this.state.pendingTopics.length) {
      return;
    }

    const next = mergePendingTopics(list, this.state.pendingTopics);
    this.state = {
      ...this.state,
      list: next,
      pendingTopics: [],
      newestTopicCreatedAtMs: newestTopicCreatedAtMs(next.topics),
    };
    this.render();
    void this.writeDebug('pending-topics-applied');
  }

  private closeReader(): void {
    this.state = {
      ...this.state,
      reader: null,
      readerTopic: null,
      loadingReader: false,
      readerError: '',
      loadingMorePosts: false,
      readerQuery: '',
      readerOpOnly: false,
      imageViewer: null,
      userPreview: null,
      nativeFeedback: null,
    };
    this.render();
  }

  private async openUserPreview(post: TopicReaderPost): Promise<void> {
    const username = post.author.username.trim();
    if (!username) {
      return;
    }

    this.state = {
      ...this.state,
      userPreview: {
        username,
        postNumber: post.postNumber,
        loading: true,
        error: '',
        profile: null,
      },
    };
    this.render();

    try {
      const profile = await this.api.fetchReaderUserProfile(username, {
        name: post.author.name,
        avatarUrl: post.author.avatarUrl,
      });
      this.state = {
        ...this.state,
        userPreview: {
          username,
          postNumber: post.postNumber,
          loading: false,
          error: '',
          profile,
        },
      };
      await this.writeDebug('user-preview-loaded');
    } catch (error) {
      this.state = {
        ...this.state,
        userPreview: {
          username,
          postNumber: post.postNumber,
          loading: false,
          error: errorMessage(error),
          profile: null,
        },
      };
      await this.writeDebug('user-preview-error');
    }
    this.render();
  }

  private openImageViewer(target: HTMLElement): void {
    const items = imageViewerItems(this.root);
    const item = imageViewerItemFromElement(target);
    if (!item) {
      return;
    }
    const index = Math.max(0, items.findIndex((candidate) => candidate.src === item.src));
    this.state = {
      ...this.state,
      imageViewer: {
        items: items.length ? items : [item],
        index,
        scale: 1,
        rotation: 0,
      },
    };
    this.render();
  }

  private updateImageViewer(action: string): void {
    const viewer = this.state.imageViewer;
    if (!viewer) {
      return;
    }

    const count = viewer.items.length;
    const next: ReaderImageViewerState = { ...viewer };
    if (action === 'previous') {
      next.index = (viewer.index - 1 + count) % count;
    } else if (action === 'next') {
      next.index = (viewer.index + 1) % count;
    } else if (action === 'zoom-in') {
      next.scale = Math.min(4, viewer.scale + 0.25);
    } else if (action === 'zoom-out') {
      next.scale = Math.max(0.25, viewer.scale - 0.25);
    } else if (action === 'rotate') {
      next.rotation = (viewer.rotation + 90) % 360;
    } else if (action === 'reset') {
      next.scale = 1;
      next.rotation = 0;
    } else if (action === 'close-image-viewer') {
      this.state = { ...this.state, imageViewer: null };
      this.render();
      return;
    }

    this.state = { ...this.state, imageViewer: next };
    this.render();
  }

  private async runNativePostAction(post: TopicReaderPost, action: NativePostAction): Promise<void> {
    const reader = this.state.reader;
    if (!reader) {
      return;
    }

    this.state = {
      ...this.state,
      nativeFeedback: {
        postNumber: post.postNumber,
        action,
        status: 'pending',
        message: `${nativeActionLabel(action)}处理中...`,
      },
    };
    this.render();

    const result = await requestNativePostAction({
      action,
      topicId: reader.id,
      topicUrl: reader.url,
      postUrl: post.url,
      postId: post.id,
      postNumber: post.postNumber,
      title: reader.title,
      username: post.author.username,
      avatarUrl: post.author.avatarUrl,
      canReply: post.actions.canReply ?? reader.actions.canReply,
      draftKey: reader.actions.draftKey,
      draftSequence: reader.actions.draftSequence,
      canLike: post.actions.canLike,
      liked: post.actions.liked,
      canBookmark: post.actions.canBookmark,
      bookmarked: post.actions.bookmarked,
      replaceExisting: true,
    });

    this.state = {
      ...this.state,
      nativeFeedback: {
        postNumber: post.postNumber,
        action,
        status: result.status,
        message: result.message || `${nativeActionLabel(action)}失败，请在原贴中重试。`,
      },
    };
    await chrome.storage.local.set({
      'debug:lastNativeAction': {
        action,
        postNumber: post.postNumber,
        ok: result.ok,
        status: result.status,
        message: result.message,
        updatedAt: new Date().toISOString(),
      },
    });
    this.render();
  }

  private async runNativePrivateMessage(post: TopicReaderPost): Promise<void> {
    this.state = {
      ...this.state,
      nativeFeedback: {
        postNumber: post.postNumber,
        action: 'private-message',
        status: 'pending',
        message: '私信窗口打开中...',
      },
    };
    this.render();

    const ok = await requestNativePrivateMessage({
      username: post.author.username,
      title: `关于：${this.state.reader?.title ?? ''}`,
      body: post.url,
      postUrl: post.url,
      replaceExisting: true,
    });

    this.state = {
      ...this.state,
      nativeFeedback: {
        postNumber: post.postNumber,
        action: 'private-message',
        status: ok ? 'opened' : 'unsupported',
        message: ok ? '已打开私信窗口。' : '原生私信不可用，请在原站重试。',
      },
    };
    await chrome.storage.local.set({
      'debug:lastNativeAction': {
        action: 'private-message',
        postNumber: post.postNumber,
        ok,
        status: ok ? 'opened' : 'unsupported',
        updatedAt: new Date().toISOString(),
      },
    });
    this.render();
  }

  private render(): void {
    const { settings } = this.state;
    window.requestAnimationFrame(() => {
      this.root.innerHTML = `
        <style>${styles}</style>
        <article class="ld-reader-shell is-${settings.layout} is-${settings.density}">
          ${this.toolbarTemplate()}
          ${this.listTemplate()}
          ${this.readerTemplate()}
          ${this.imageViewerTemplate()}
        </article>
      `;
      this.bindEvents();
    });
  }

  private toolbarTemplate(): string {
    const { settings, list, loadingList } = this.state;
    return `
      <header class="ld-reader-toolbar">
        <div>
          <strong>Linux.do Reader</strong>
          <span>${escapeHtml(this.options.title || list?.endpoint || this.options.endpoint)}</span>
        </div>
        <div class="ld-reader-controls" role="toolbar" aria-label="Reader controls">
          <button type="button" data-action="refresh-list" ${loadingList ? 'disabled' : ''}>Refresh</button>
          <label>
            <span>Layout</span>
            <select data-setting="layout">
              <option value="grid" ${settings.layout === 'grid' ? 'selected' : ''}>Cards</option>
              <option value="masonry" ${settings.layout === 'masonry' ? 'selected' : ''}>Masonry</option>
              <option value="reader" ${settings.layout === 'reader' ? 'selected' : ''}>Reader</option>
            </select>
          </label>
          <label>
            <span>Density</span>
            <select data-setting="density">
              <option value="comfortable" ${settings.density === 'comfortable' ? 'selected' : ''}>Comfort</option>
              <option value="compact" ${settings.density === 'compact' ? 'selected' : ''}>Compact</option>
            </select>
          </label>
        </div>
      </header>
      ${
        this.state.pendingTopics.length
          ? `<section class="ld-new-topic-notice" role="status">
              <span>${this.state.pendingTopics.length} new topics</span>
              <button type="button" data-action="apply-pending-topics">Update</button>
            </section>`
          : ''
      }
    `;
  }

  private listTemplate(): string {
    const { list, loadingList, listError } = this.state;
    if (loadingList && !list) {
      return '<section class="ld-reader-state">Loading topics...</section>';
    }

    if (listError && !list) {
      return `<section class="ld-reader-state is-error">${escapeHtml(listError)}</section>`;
    }

    const topics = list?.topics ?? [];
    return `
      <section class="ld-topic-grid" aria-label="Linux.do topics">
        ${topics.map((topic) => this.topicCardTemplate(topic)).join('')}
      </section>
      <footer class="ld-reader-footer">
        ${listError ? `<p class="ld-error">${escapeHtml(listError)}</p>` : ''}
        ${
          list?.moreTopicsUrl
            ? `<button type="button" data-action="load-more-topics" ${loadingList ? 'disabled' : ''}>${
                loadingList ? '读取中...' : '加载更多话题'
              }</button>`
            : ''
        }
      </footer>
    `;
  }

  private topicCardTemplate(topic: TopicCardData): string {
    const variant = topic.thumbnailUrl ? 'media' : topic.excerpt.length > 120 ? 'feature' : 'text';
    return `
      <button type="button" class="ld-topic-card is-${variant}" data-topic-id="${topic.id}">
        ${topic.thumbnailUrl ? `<img src="${escapeAttribute(topic.thumbnailUrl)}" alt="" loading="lazy" />` : ''}
        <span class="ld-topic-card__body">
          <span class="ld-topic-card__title">${escapeHtml(topic.title)}</span>
          <span class="ld-topic-card__meta">
            ${escapeHtml(topic.category?.name ?? 'uncategorized')} | ${topic.stats.replies} 回复 | ${topic.stats.views} 浏览
          </span>
          ${topic.excerpt ? `<span class="ld-topic-card__excerpt">${escapeHtml(topic.excerpt)}</span>` : ''}
        </span>
      </button>
    `;
  }

  private readerTemplate(): string {
    const { reader, readerTopic, loadingReader, readerError, loadingMorePosts } = this.state;
    if (!reader && !readerTopic) {
      return '';
    }

    return `
      <div class="ld-reader-modal" role="dialog" aria-modal="true" aria-label="话题阅读器">
        <div class="ld-reader-backdrop" data-action="close-reader"></div>
        <article class="ld-reader-dialog">
          <header class="ld-reader-dialog__header">
            <div>
              <strong>${escapeHtml(reader?.title ?? readerTopic?.title ?? 'Loading topic')}</strong>
              <span>${reader ? `${reader.stats.posts} posts | ${reader.stats.views} 浏览` : '读取中...'}</span>
            </div>
            <div>
              ${reader ? `<a href="${escapeAttribute(linuxDoAbsoluteUrl(linuxDoPreferredTopicUrl(reader.url, this.state.settings.topicUrlView)))}" target="_blank" rel="noopener noreferrer">Open original</a>` : ''}
              <button type="button" data-action="close-reader" aria-label="Close reader">Close</button>
            </div>
          </header>
          ${loadingReader && !reader ? '<section class="ld-reader-state">Loading topic...</section>' : ''}
          ${readerError ? `<section class="ld-reader-state is-error">${escapeHtml(readerError)}</section>` : ''}
          ${
            reader
              ? `${this.readerToolsTemplate(reader)}
                <section class="ld-reader-posts">
                  ${visibleReaderPosts(reader, {
                    sortOrder: this.state.settings.commentSortOrder,
                    query: this.state.readerQuery,
                    opOnly: this.state.readerOpOnly,
                  })
                    .map((post) => this.readerPostTemplate(post))
                    .join('')}
                </section>
                ${
                  reader.hasMorePosts
                    ? `<button type="button" class="ld-load-more-posts" data-action="load-more-posts" ${
                        loadingMorePosts ? 'disabled' : ''
                      }>${loadingMorePosts ? '读取中...' : '加载更多评论'}</button>`
                    : ''
                }`
              : ''
          }
        </article>
      </div>
    `;
  }

  private readerToolsTemplate(reader: TopicReaderData): string {
    const visibleCount = visibleReaderPosts(reader, {
      sortOrder: this.state.settings.commentSortOrder,
      query: this.state.readerQuery,
      opOnly: this.state.readerOpOnly,
    }).length;

    return `
      <section class="ld-reader-tools" aria-label="Reader comment tools">
        <label>
          <span>Search</span>
          <input type="search" data-reader-search value="${escapeAttribute(this.state.readerQuery)}" placeholder="搜索评论" />
        </label>
        <label>
          <span>Sort</span>
          <select data-reader-sort>
            <option value="asc" ${this.state.settings.commentSortOrder === 'asc' ? 'selected' : ''}>最早在前</option>
            <option value="desc" ${this.state.settings.commentSortOrder === 'desc' ? 'selected' : ''}>最新在前</option>
          </select>
        </label>
        <label class="ld-reader-check">
          <input type="checkbox" data-reader-op-only ${this.state.readerOpOnly ? 'checked' : ''} />
          <span>OP only</span>
        </label>
        <span>${visibleCount}/${reader.posts.length} visible</span>
      </section>
    `;
  }

  private readerPostTemplate(post: TopicReaderData['posts'][number]): string {
    const preview = this.state.userPreview;
    const profile = preview?.postNumber === post.postNumber ? preview.profile : null;
    const feedback = this.state.nativeFeedback?.postNumber === post.postNumber ? this.state.nativeFeedback : null;
    return `
      <article class="ld-reader-post ${post.isOriginalPost ? 'is-op' : ''}">
        <header>
          <button type="button" class="ld-author-button" data-user-post-number="${post.postNumber}">
            ${escapeHtml(post.author.name || post.author.username)}
          </button>
          <a href="${escapeAttribute(linuxDoAbsoluteUrl(linuxDoPreferredTopicUrl(post.url, this.state.settings.topicUrlView)))}" target="_blank" rel="noopener noreferrer">#${post.postNumber}</a>
        </header>
        ${
          preview?.postNumber === post.postNumber
            ? `<aside class="ld-user-preview" aria-label="User preview">
                <strong>${escapeHtml(profile?.name || post.author.name || post.author.username)}</strong>
                <span>@${escapeHtml(profile?.username || post.author.username)}</span>
                <span>${preview.loading ? 'Loading profile...' : preview.error ? escapeHtml(preview.error) : `Joined ${escapeHtml(profile?.joinedAt || 'unknown')}`}</span>
                <a href="${escapeAttribute(linuxDoAbsoluteUrl(profile?.profileUrl || `/u/${post.author.username}/summary`))}" target="_blank" rel="noopener noreferrer">Profile</a>
                <button type="button" data-native-message-post-number="${post.postNumber}">Message</button>
              </aside>`
            : ''
        }
        <section class="ld-native-actions" aria-label="Native post actions">
          <button type="button" data-native-post-number="${post.postNumber}" data-native-post-action="reply">Reply</button>
          <button type="button" data-native-post-number="${post.postNumber}" data-native-post-action="like">Like</button>
          <button type="button" data-native-post-number="${post.postNumber}" data-native-post-action="bookmark">Bookmark</button>
        </section>
        ${
          feedback
            ? `<p class="ld-native-feedback is-${escapeAttribute(feedback.status)}" role="status">${escapeHtml(feedback.message)}</p>`
            : ''
        }
        <div class="ld-reader-prose">${post.html}</div>
      </article>
    `;
  }

  private imageViewerTemplate(): string {
    const viewer = this.state.imageViewer;
    if (!viewer) {
      return '';
    }

    const item = viewer.items[viewer.index] ?? viewer.items[0];
    if (!item) {
      return '';
    }

    return `
      <div class="ld-image-viewer" role="dialog" aria-modal="true" aria-label="Image viewer">
        <button type="button" class="ld-image-viewer__backdrop" data-image-action="close-image-viewer" aria-label="Close image viewer"></button>
        <section class="ld-image-viewer__dialog" style="--image-scale:${viewer.scale};--image-rotation:${viewer.rotation}deg">
          <div class="ld-image-viewer__stage">
            <img src="${escapeAttribute(item.src)}" alt="${escapeAttribute(item.alt)}" />
          </div>
          <div class="ld-image-viewer__toolbar">
            <button type="button" data-image-action="previous" ${viewer.items.length <= 1 ? 'disabled' : ''}>Previous</button>
            <span>${viewer.index + 1}/${viewer.items.length}</span>
            <button type="button" data-image-action="next" ${viewer.items.length <= 1 ? 'disabled' : ''}>Next</button>
            <button type="button" data-image-action="zoom-out">Zoom out</button>
            <span>${Math.round(viewer.scale * 100)}%</span>
            <button type="button" data-image-action="zoom-in">Zoom in</button>
            <button type="button" data-image-action="rotate">Rotate</button>
            <button type="button" data-image-action="reset">Reset</button>
            <a href="${escapeAttribute(item.originalUrl)}" target="_blank" rel="noopener noreferrer">Open</a>
            <a href="${escapeAttribute(item.originalUrl)}" download target="_blank" rel="noopener noreferrer">Download</a>
            <button type="button" data-image-action="close-image-viewer">Close</button>
          </div>
        </section>
      </div>
    `;
  }

  private bindEvents(): void {
    this.root.querySelector('[data-action="refresh-list"]')?.addEventListener('click', () => {
      void this.loadList();
    });
    this.root.querySelector('[data-action="load-more-topics"]')?.addEventListener('click', () => {
      void this.loadMoreTopics();
    });
    this.root.querySelector('[data-action="apply-pending-topics"]')?.addEventListener('click', () => {
      this.applyPendingTopics();
    });
    this.root.querySelectorAll('[data-action="close-reader"]').forEach((element) => {
      element.addEventListener('click', () => this.closeReader());
    });
    this.root.querySelector('[data-action="load-more-posts"]')?.addEventListener('click', () => {
      void this.loadMorePosts();
    });
    this.root.querySelectorAll<HTMLElement>('[data-topic-id]').forEach((element) => {
      element.addEventListener('click', () => {
        const topicId = Number(element.dataset.topicId);
        const topic = this.state.list?.topics.find((item) => item.id === topicId);
        if (topic) {
          void this.openReader(topic);
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-user-post-number]').forEach((element) => {
      element.addEventListener('click', () => {
        const postNumber = Number(element.dataset.userPostNumber);
        const post = this.state.reader?.posts.find((item) => item.postNumber === postNumber);
        if (post) {
          void this.openUserPreview(post);
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-native-post-action]').forEach((element) => {
      element.addEventListener('click', () => {
        const postNumber = Number(element.dataset.nativePostNumber);
        const action = element.dataset.nativePostAction;
        const post = this.state.reader?.posts.find((item) => item.postNumber === postNumber);
        if (post && isNativePostAction(action)) {
          void this.runNativePostAction(post, action);
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-native-message-post-number]').forEach((element) => {
      element.addEventListener('click', () => {
        const postNumber = Number(element.dataset.nativeMessagePostNumber);
        const post = this.state.reader?.posts.find((item) => item.postNumber === postNumber);
        if (post) {
          void this.runNativePrivateMessage(post);
        }
      });
    });
    this.root.querySelectorAll<HTMLElement>('.ldcv-reader-image-link, img.ldcv-reader-image').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        this.openImageViewer(element);
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-image-action]').forEach((element) => {
      element.addEventListener('click', () => {
        this.updateImageViewer(element.dataset.imageAction ?? '');
      });
    });
    this.root.querySelectorAll<HTMLSelectElement>('[data-setting]').forEach((element) => {
      element.addEventListener('change', () => {
        const key = element.dataset.setting;
        if (key === 'layout' || key === 'density') {
          void this.updateSettings({ [key]: element.value } as Partial<ExtensionSettings>);
        }
      });
    });
    this.root.querySelector<HTMLInputElement>('[data-reader-search]')?.addEventListener('input', (event) => {
      const target = event.currentTarget as HTMLInputElement;
      this.state = {
        ...this.state,
        readerQuery: target.value,
      };
      this.render();
    });
    this.root.querySelector<HTMLSelectElement>('[data-reader-sort]')?.addEventListener('change', (event) => {
      const target = event.currentTarget as HTMLSelectElement;
      const value = target.value;
      if (value === 'asc' || value === 'desc') {
        void this.updateSettings({ commentSortOrder: value });
      }
    });
    this.root.querySelector<HTMLInputElement>('[data-reader-op-only]')?.addEventListener('change', (event) => {
      const target = event.currentTarget as HTMLInputElement;
      this.state = {
        ...this.state,
        readerOpOnly: target.checked,
      };
      this.render();
    });
  }

  private async writeDebug(event: string): Promise<void> {
    await chrome.storage.local.set({
      'debug:lastContentReader': {
        mounted: true,
        event,
        endpoint: this.options.endpoint,
        layout: this.state.settings.layout,
        density: this.state.settings.density,
        topicCount: this.state.list?.topics.length ?? 0,
        pendingTopicCount: this.state.pendingTopics.length,
        readerTopicId: this.state.reader?.id ?? null,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

const styles = `
  :host {
    color: var(--text);
    display: block;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    margin: 0 auto 18px;
    max-width: 1180px;
  }

  * {
    box-sizing: border-box;
  }

  button,
  select {
    font: inherit;
  }

  .ld-reader-shell {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .ld-reader-toolbar {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .ld-reader-toolbar strong {
    display: block;
    font-size: 16px;
    line-height: 1.3;
  }

  .ld-reader-toolbar span {
    color: var(--muted);
    display: block;
    font-size: 12px;
    line-height: 1.4;
  }

  .ld-reader-controls {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }

  .ld-reader-controls label {
    align-items: center;
    display: inline-flex;
    gap: 5px;
  }

  .ld-reader-controls button,
  .ld-reader-controls select,
  .ld-reader-footer button,
  .ld-load-more-posts,
  .ld-reader-dialog__header button,
  .ld-reader-dialog__header a {
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: 7px;
    color: var(--text);
    cursor: pointer;
    min-height: 32px;
    padding: 6px 10px;
    text-decoration: none;
  }

  .ld-reader-controls button:disabled,
  .ld-reader-footer button:disabled,
  .ld-load-more-posts:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .ld-new-topic-notice {
    align-items: center;
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    border: 1px solid var(--color-warning);
    border-radius: 8px;
    color: color-mix(in srgb, var(--color-warning) 80%, var(--text) 20%);
    display: flex;
    gap: 10px;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 10px 12px;
  }

  .ld-new-topic-notice button {
    background: var(--surface);
    border: 1px solid var(--color-warning);
    border-radius: 7px;
    color: color-mix(in srgb, var(--color-warning) 90%, var(--text) 10%);
    cursor: pointer;
    min-height: 30px;
    padding: 5px 10px;
  }

  .ld-topic-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  }

  .ld-reader-shell.is-masonry .ld-topic-grid {
    column-count: 3;
    column-gap: 10px;
    display: block;
  }

  .ld-reader-shell.is-reader .ld-topic-grid {
    grid-template-columns: 1fr;
  }

  .ld-topic-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: inherit;
    cursor: pointer;
    display: grid;
    gap: 8px;
    margin: 0;
    min-height: 150px;
    overflow: hidden;
    padding: 0;
    text-align: left;
    width: 100%;
  }

  .ld-reader-shell.is-masonry .ld-topic-card {
    break-inside: avoid;
    margin-bottom: 10px;
  }

  .ld-reader-shell.is-compact .ld-topic-card {
    min-height: 0;
  }

  .ld-topic-card:hover,
  .ld-topic-card:focus-visible {
    border-color: var(--accent);
    outline: none;
  }

  .ld-topic-card img {
    aspect-ratio: 16 / 9;
    height: auto;
    object-fit: cover;
    width: 100%;
  }

  .ld-topic-card__body {
    display: grid;
    gap: 6px;
    padding: 12px;
  }

  .ld-topic-card__title {
    font-size: 14px;
    font-weight: 750;
    line-height: 1.35;
  }

  .ld-topic-card__meta,
  .ld-topic-card__excerpt {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.45;
  }

  .ld-topic-card__excerpt {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
  }

  .ld-reader-shell.is-compact .ld-topic-card__excerpt {
    -webkit-line-clamp: 2;
  }

  .ld-reader-footer {
    display: flex;
    justify-content: center;
    margin-top: 12px;
  }

  .ld-reader-state,
  .ld-error {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--muted);
    padding: 14px;
  }

  .ld-reader-state.is-error,
  .ld-error {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-error) 30%, transparent);
    color: var(--color-error);
  }

  .ld-reader-modal {
    inset: 0;
    position: fixed;
    z-index: 2147483646;
  }

  .ld-reader-backdrop {
    background: rgba(20, 28, 43, 0.5);
    inset: 0;
    position: absolute;
  }

  .ld-reader-dialog {
    background: var(--surface);
    border-radius: 8px;
    box-shadow: 0 18px 50px rgba(8, 15, 31, 0.35);
    display: grid;
    gap: 10px;
    left: 50%;
    max-height: min(86vh, 980px);
    max-width: min(920px, calc(100vw - 36px));
    overflow: auto;
    padding: 14px;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 860px;
  }

  .ld-reader-dialog__header {
    align-items: flex-start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    padding: 12px;
  }

  .ld-reader-dialog__header strong {
    display: block;
    font-size: 18px;
    line-height: 1.3;
  }

  .ld-reader-dialog__header div:last-child {
    display: flex;
    gap: 8px;
  }

  .ld-reader-posts {
    display: grid;
    gap: 10px;
  }

  .ld-reader-tools {
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px;
  }

  .ld-reader-tools label {
    align-items: center;
    display: inline-flex;
    gap: 6px;
  }

  .ld-reader-tools input[type="search"],
  .ld-reader-tools select {
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: 7px;
    min-height: 30px;
    padding: 5px 8px;
  }

  .ld-reader-tools span {
    color: var(--muted);
    font-size: 12px;
  }

  .ld-reader-post {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
  }

  .ld-reader-post.is-op {
    border-left: 3px solid var(--accent);
  }

  .ld-reader-post header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .ld-reader-post header a {
    color: var(--accent);
    text-decoration: none;
  }

  .ld-author-button {
    background: transparent;
    border: 0;
    color: var(--text);
    cursor: pointer;
    font: inherit;
    font-weight: 750;
    padding: 0;
  }

  .ld-author-button:hover {
    color: var(--accent);
  }

  .ld-user-preview {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
    padding: 10px;
  }

  .ld-user-preview span,
  .ld-user-preview a {
    color: var(--muted);
    font-size: 12px;
  }

  .ld-user-preview button,
  .ld-native-actions button {
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 7px;
    color: var(--accent);
    cursor: pointer;
    font-size: 12px;
    min-height: 28px;
    padding: 4px 8px;
  }

  .ld-native-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .ld-native-feedback {
    border-radius: 7px;
    font-size: 12px;
    margin: 0 0 10px;
    padding: 8px;
  }

  .ld-native-feedback.is-pending {
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: color-mix(in srgb, var(--color-warning) 80%, var(--text) 20%);
  }

  .ld-native-feedback.is-success,
  .ld-native-feedback.is-opened {
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    color: var(--color-success);
  }

  .ld-native-feedback.is-unsupported,
  .ld-native-feedback.is-error,
  .ld-native-feedback.is-timeout {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    color: var(--color-error);
  }

  .ld-reader-prose {
    color: var(--text);
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .ld-reader-prose img {
    border-radius: 6px;
    height: auto;
    max-width: 100%;
  }

  .ld-load-more-posts {
    justify-self: center;
  }

  .ld-image-viewer {
    inset: 0;
    position: fixed;
    z-index: 2147483647;
  }

  .ld-image-viewer__backdrop {
    background: rgba(8, 15, 31, 0.78);
    border: 0;
    inset: 0;
    position: absolute;
  }

  .ld-image-viewer__dialog {
    display: grid;
    gap: 12px;
    inset: 24px;
    place-items: center;
    position: absolute;
  }

  .ld-image-viewer__stage {
    display: grid;
    min-height: 0;
    place-items: center;
  }

  .ld-image-viewer__stage img {
    max-height: calc(100vh - 150px);
    max-width: calc(100vw - 60px);
    transform: scale(var(--image-scale, 1)) rotate(var(--image-rotation, 0deg));
  }

  .ld-image-viewer__toolbar {
    align-items: center;
    background: var(--surface);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    max-width: min(760px, calc(100vw - 40px));
    padding: 10px;
  }

  .ld-image-viewer__toolbar button,
  .ld-image-viewer__toolbar a {
    background: var(--surface);
    border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
    border-radius: 7px;
    color: var(--text);
    cursor: pointer;
    min-height: 30px;
    padding: 5px 8px;
    text-decoration: none;
  }

  @media (max-width: 860px) {
    :host {
      margin-left: 10px;
      margin-right: 10px;
    }

    .ld-reader-toolbar,
    .ld-reader-dialog__header {
      align-items: stretch;
      flex-direction: column;
    }

    .ld-reader-shell.is-masonry .ld-topic-grid {
      column-count: 1;
    }
  }
`;

function imageViewerItems(root: ShadowRoot): ReaderImageViewerItem[] {
  const items: ReaderImageViewerItem[] = [];
  const seen = new Set<string>();
  root.querySelectorAll<HTMLElement>('.ldcv-reader-image-link, img.ldcv-reader-image').forEach((element) => {
    if (element instanceof HTMLImageElement && element.closest('.ldcv-reader-image-link')) {
      return;
    }
    const item = imageViewerItemFromElement(element);
    if (!item || seen.has(item.src)) {
      return;
    }
    seen.add(item.src);
    items.push(item);
  });
  return items;
}

function imageViewerItemFromElement(element: HTMLElement): ReaderImageViewerItem | null {
  const image = element instanceof HTMLImageElement ? element : element.querySelector<HTMLImageElement>('img');
  const src =
    element.getAttribute('data-reader-image') ||
    image?.getAttribute('data-reader-image-src') ||
    image?.currentSrc ||
    image?.src ||
    '';
  if (!src || isEmojiImage(image)) {
    return null;
  }

  return {
    src,
    originalUrl: element.getAttribute('href') || src,
    alt: image?.getAttribute('data-reader-image-alt') || image?.alt || 'Image',
  };
}

function isEmojiImage(image: HTMLImageElement | null | undefined): boolean {
  if (!image) {
    return false;
  }
  const marker = `${image.className} ${image.alt} ${image.title} ${image.src}`;
  return /\b(ldcv-reader-emoji|emoji|emoticon|smiley|twemoji)\b/i.test(marker);
}

function isNativePostAction(value: unknown): value is NativePostAction {
  return value === 'reply' || value === 'like' || value === 'bookmark';
}

function nativeActionLabel(action: NativePostAction): string {
  if (action === 'reply') {
    return '回复';
  }
  if (action === 'like') {
    return '点赞';
  }
  return '书签';
}
