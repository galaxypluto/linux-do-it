(function () {
  "use strict";

  const PRIVATE_MESSAGE_EVENT = "linuxdo-card-view:private-message";
  const PRIVATE_MESSAGE_RESULT_EVENT = "linuxdo-card-view:private-message-result";
  const PRIVATE_MESSAGE_CLOSE_EVENT = "linuxdo-card-view:close-private-message";
  const NATIVE_POST_ACTION_EVENT = "linuxdo-card-view:native-post-action";
  const NATIVE_POST_ACTION_RESULT_EVENT = "linuxdo-card-view:native-post-action-result";
  const TOPIC_VIEW_TRACK_EVENT = "linuxdo-card-view:track-topic-view";
  const TOPIC_VIEW_TRACK_RESULT_EVENT = "linuxdo-card-view:track-topic-view-result";
  const NATIVE_REPLY_SUBMITTED_EVENT = "linuxdo-card-view:native-reply-submitted";
  const NATIVE_ROUTE_RESTORE_EVENT = "linuxdo-card-view:restore-route";
  const NAVIGATION_EVENT = "linuxdo-card-view:navigation";
  const READER_REPLY_NAVIGATION_GUARD_MS = 10 * 60 * 1000;
  const READER_REPLY_SUBMIT_SUPPRESSION_MS = 30000;
  const READER_REPLY_ROUTE_RESTORING_CLASS = "ldcv-native-reply-route-restoring";
  const READER_REPLY_ROUTE_RESTORE_DELAYS = [0, 80, 180, 320, 520, 800, 1200, 1800, 2600, 3800, 5200];
  const CONTROLLED_REPLY_SUBMIT_ERROR_CLASS = "linuxdo-card-view-controlled-reply-error";

  window.__linuxdoCardViewReplyNavigationGuard = window.__linuxdoCardViewReplyNavigationGuard || null;

  patchHistory("pushState");
  patchHistory("replaceState");

  if (window.__linuxdoCardViewPrivateMessageHandler) {
    window.removeEventListener(PRIVATE_MESSAGE_EVENT, window.__linuxdoCardViewPrivateMessageHandler);
  }

  window.__linuxdoCardViewPrivateMessageHandler = (event) => {
    const detail = event.detail || {};
    Promise.resolve(openNativePrivateMessage(detail))
      .then((ok) => {
        window.dispatchEvent(
          new CustomEvent(PRIVATE_MESSAGE_RESULT_EVENT, {
            detail: {
              requestId: detail.requestId,
              ok
            }
          })
        );
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent(PRIVATE_MESSAGE_RESULT_EVENT, {
            detail: {
              requestId: detail.requestId,
              ok: false
            }
          })
        );
      });
  };
  window.addEventListener(PRIVATE_MESSAGE_EVENT, window.__linuxdoCardViewPrivateMessageHandler);

  if (window.__linuxdoCardViewPrivateMessageCloseHandler) {
    window.removeEventListener(PRIVATE_MESSAGE_CLOSE_EVENT, window.__linuxdoCardViewPrivateMessageCloseHandler);
  }

  window.__linuxdoCardViewPrivateMessageCloseHandler = () => {
    closeNativePrivateMessage();
  };
  window.addEventListener(PRIVATE_MESSAGE_CLOSE_EVENT, window.__linuxdoCardViewPrivateMessageCloseHandler);

  if (window.__linuxdoCardViewNativePostActionHandler) {
    window.removeEventListener(NATIVE_POST_ACTION_EVENT, window.__linuxdoCardViewNativePostActionHandler);
  }

  window.__linuxdoCardViewNativePostActionHandler = (event) => {
    const detail = event.detail || {};
    Promise.resolve(runNativePostAction(detail))
      .then((outcome) => {
        window.dispatchEvent(
          new CustomEvent(NATIVE_POST_ACTION_RESULT_EVENT, {
            detail: {
              requestId: detail.requestId,
              ...outcome
            }
          })
        );
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent(NATIVE_POST_ACTION_RESULT_EVENT, {
            detail: {
              requestId: detail.requestId,
              ok: false,
              status: "error",
              message: "原生操作失败，请在原贴中重试。",
              fallbackUrl: postUrlFromDetail(detail)
            }
          })
        );
      });
  };
  window.addEventListener(NATIVE_POST_ACTION_EVENT, window.__linuxdoCardViewNativePostActionHandler);

  if (window.__linuxdoCardViewTopicViewTrackHandler) {
    window.removeEventListener(TOPIC_VIEW_TRACK_EVENT, window.__linuxdoCardViewTopicViewTrackHandler);
  }

  window.__linuxdoCardViewTopicViewTrackHandler = (event) => {
    const detail = event.detail || {};
    Promise.resolve(trackTopicViewInPageContext(detail))
      .then((ok) => {
        window.dispatchEvent(
          new CustomEvent(TOPIC_VIEW_TRACK_RESULT_EVENT, {
            detail: {
              requestId: detail.requestId,
              ok
            }
          })
        );
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent(TOPIC_VIEW_TRACK_RESULT_EVENT, {
            detail: {
              requestId: detail.requestId,
              ok: false
            }
          })
        );
      });
  };
  window.addEventListener(TOPIC_VIEW_TRACK_EVENT, window.__linuxdoCardViewTopicViewTrackHandler);

  if (window.__linuxdoCardViewRouteRestoreHandler) {
    window.removeEventListener(NATIVE_ROUTE_RESTORE_EVENT, window.__linuxdoCardViewRouteRestoreHandler);
  }

  window.__linuxdoCardViewRouteRestoreHandler = (event) => {
    restoreDiscourseRoute((event.detail || {}).returnUrl);
  };
  window.addEventListener(NATIVE_ROUTE_RESTORE_EVENT, window.__linuxdoCardViewRouteRestoreHandler);

  if (window.__linuxdoCardViewControlledReplyClickHandler) {
    document.removeEventListener("click", window.__linuxdoCardViewControlledReplyClickHandler, true);
  }
  if (window.__linuxdoCardViewControlledReplyKeydownHandler) {
    document.removeEventListener("keydown", window.__linuxdoCardViewControlledReplyKeydownHandler, true);
  }

  window.__linuxdoCardViewControlledReplyClickHandler = (event) => {
    handleControlledReaderReplySubmit(event, "click");
  };
  window.__linuxdoCardViewControlledReplyKeydownHandler = (event) => {
    handleControlledReaderReplySubmit(event, "keydown");
  };
  document.addEventListener("click", window.__linuxdoCardViewControlledReplyClickHandler, true);
  document.addEventListener("keydown", window.__linuxdoCardViewControlledReplyKeydownHandler, true);

  async function trackTopicViewInPageContext(detail) {
    const topicId = numeric(detail.topicId);
    const slug = String(detail.slug || "topic").trim() || "topic";
    if (!topicId) {
      return false;
    }

    const topicUrl = String(detail.topicUrl || `${window.location.origin}/t/${slug}/${topicId}`);
    const referrer = String(detail.referrer || window.location.href);
    const sessionId = readTrackViewSessionId();
    const headers = {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Discourse-Track-View": "true",
      "Discourse-Track-View-Topic-Id": String(topicId),
      "Discourse-Track-View-Url": topicUrl,
      "Discourse-Track-View-Referrer": referrer,
      "Discourse-Present": "true"
    };
    if (sessionId) {
      headers["Discourse-Track-View-Session-Id"] = sessionId;
    }

    const ajaxModule = requireModule("discourse/lib/ajax");
    const ajax =
      ajaxModule && (typeof ajaxModule.ajax === "function"
        ? ajaxModule.ajax
        : ajaxModule.default && typeof ajaxModule.default.ajax === "function"
          ? ajaxModule.default.ajax
          : null);
    if (typeof ajax === "function") {
      try {
        await ajax(`/t/${slug}/${topicId}.json`, { type: "GET", headers });
        return true;
      } catch {
        return false;
      }
    }

    try {
      const response = await fetch(`/t/${slug}/${topicId}.json`, {
        credentials: "include",
        headers
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function readTrackViewSessionId() {
    const content =
      document.querySelector('meta[name="discourse-track-view-session-id"]')?.getAttribute("content") || "";
    if (!content || content.includes("track_view_session_id_placeholder")) {
      return "";
    }
    return content;
  }

  async function openNativePrivateMessage(detail) {
    const username = String(detail.username || "").trim();
    if (!username) {
      return false;
    }

    const title = String(detail.title || "开始消息");
    const body = String(detail.body || detail.postUrl || "");
    const composer = lookup("service:composer") || lookup("controller:composer");
    const composerModel = requireModule("discourse/models/composer") || {};
    const composerConstants = composerModel.default || composerModel;
    const action = composerConstants.PRIVATE_MESSAGE || "privateMessage";
    const draftKey = composerConstants.NEW_PRIVATE_MESSAGE_KEY || "new_private_message";

    if (detail.replaceExisting && nativeComposerVisible()) {
      await discardExistingComposer(composer);
    }

    if (isCallable(composer, "openNewMessage")) {
      await composer.openNewMessage({
        recipients: username,
        title,
        body,
        hasGroups: false
      });
      return true;
    }

    if (isCallable(composer, "open")) {
      await composer.open({
        action,
        archetypeId: "private_message",
        draftKey,
        draftSequence: 0,
        recipients: username,
        usernames: username,
        topicTitle: title,
        topicBody: body,
        reply: body
      });
      return true;
    }

    return false;
  }

  async function runNativePostAction(detail) {
    const action = String(detail.action || "");
    if (action === "reply") {
      return openNativeReply(detail);
    }
    if (action === "like") {
      return runNativeLike(detail);
    }
    if (action === "bookmark") {
      return runNativeBookmark(detail);
    }
    return nativeOutcome(false, "unsupported", "不支持的帖子操作。", postUrlFromDetail(detail));
  }

  async function openNativeReply(detail) {
    const composer = lookup("service:composer") || lookup("controller:composer");
    const topicId = numeric(detail.topicId);
    const postNumber = numeric(detail.postNumber);
    const fallbackUrl = postUrlFromDetail(detail);

    if (!composer || !isCallable(composer, "open") || !topicId || !postNumber) {
      return nativeOutcome(false, "unsupported", "原生回复不可用，已保留原贴入口。", fallbackUrl);
    }
    if (detail.canReply === false) {
      return nativeOutcome(false, "unsupported", "当前账号没有回复权限，或需要先登录。", fallbackUrl);
    }

    const topic = nativeCachedReplyTopicFromDetail(detail) || (await findNativeTopic(detail)) || nativeTopicFromDetail(detail);
    if (!topic) {
      return nativeOutcome(false, "unsupported", "原生回复不可用，已保留原贴入口。", fallbackUrl);
    }

    const canCreatePost = detail.canReply === true || modelGet(topic, "details.can_create_post");
    if (!canCreatePost) {
      return nativeOutcome(false, "unsupported", "当前账号没有回复权限，或需要先登录。", fallbackUrl);
    }

    if (detail.replaceExisting && nativeComposerVisible()) {
      await discardExistingComposer(composer);
    }

    try {
      return await openReplyWithTopic(composer, topic, detail);
    } catch {
      return nativeOutcome(false, "error", "原生回复窗口打开失败，请在原贴中重试。", fallbackUrl);
    }
  }

  async function runNativeLike(detail) {
    const fallbackUrl = postUrlFromDetail(detail);
    if (detail.canLike === false && detail.liked !== true) {
      return nativeOutcome(false, "unsupported", "当前账号没有点赞权限，或需要先登录。", fallbackUrl);
    }

    const topic = await findNativeTopic(detail);
    const post = topic ? await findNativePost(topic, detail) : null;

    if (!post) {
      return nativeOutcome(false, "unsupported", "无法定位这条帖子的点赞入口。", fallbackUrl);
    }

    const likeAction = modelGet(post, "likeAction") || modelGet(post, "actionByName.like");
    if (!likeAction || !nativeLikeActionCanRun(likeAction)) {
      return nativeOutcome(false, "unsupported", "当前账号没有点赞权限，或需要先登录。", fallbackUrl);
    }
    ensurePostActionRuntime(post);

    if (isCallable(likeAction, "togglePromise")) {
      const result = await likeAction.togglePromise(post);
      const acted = confirmedBoolean(modelGet(result, "acted")) ?? confirmedBoolean(modelGet(likeAction, "acted")) ?? !detail.liked;
      return nativeOutcome(true, "success", acted ? "已点赞。" : "已取消点赞。", undefined, { acted });
    }

    if (isCallable(likeAction, "act")) {
      await likeAction.act(post);
      return nativeOutcome(true, "success", "已点赞。", undefined, { acted: true });
    }

    return nativeOutcome(false, "unsupported", "原生点赞入口不可用。", fallbackUrl);
  }

  async function openReplyWithTopic(composer, topic, detail) {
    const topicId = numeric(detail.topicId);
    const postNumber = numeric(detail.postNumber);
    const fallbackUrl = postUrlFromDetail(detail);
    const composerModel = requireModule("discourse/models/composer") || {};
    const composerConstants = composerModel.default || composerModel;
    const opts = {
      action: composerConstants.REPLY || "reply",
      draftKey: String(detail.draftKey || "") || modelGet(topic, "draft_key") || `topic_${topicId}`,
      draftSequence: numericAllowZero(detail.draftSequence, modelGet(topic, "draft_sequence") || 0)
    };

    if (postNumber > 1) {
      const post = (await findNativePost(topic, detail)) || nativeReplyPostFromDetail(topic, detail);
      if (!post) {
        return nativeOutcome(false, "unsupported", "无法定位这条评论的原生回复入口。", fallbackUrl);
      }
      ensurePostTopic(post, topic);
      opts.post = post;
    } else {
      opts.topic = topic;
    }

    await composer.open(opts);
    armReaderReplyNavigationGuard(detail);
    return nativeOutcome(true, "opened", "已打开回复窗口。");
  }

  function handleControlledReaderReplySubmit(event, type) {
    const guard = activeControlledReplyGuard();
    if (!guard) {
      return;
    }
    if (type === "click" && !isControlledReplySubmitClick(event)) {
      return;
    }
    if (type === "keydown" && !isControlledReplySubmitKeydown(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (isCallable(event, "stopImmediatePropagation")) {
      event.stopImmediatePropagation();
    }

    if (guard.controlledReplySubmitting) {
      return;
    }

    const raw = controlledReplyRaw();
    if (!raw) {
      showControlledReplySubmitError("帖子不能为空。");
      return;
    }

    guard.controlledReplySubmitting = true;
    clearControlledReplySubmitError();
    setControlledReplySubmitting(true);
    Promise.resolve(submitControlledReaderReply(guard, raw))
      .catch((error) => {
        guard.controlledReplySubmitting = false;
        setControlledReplySubmitting(false);
        showControlledReplySubmitError(controlledReplySubmitErrorMessage(error));
      });
  }

  function activeControlledReplyGuard() {
    const guard = window.__linuxdoCardViewReplyNavigationGuard;
    if (!guard || Date.now() > guard.expiresAt || guard.dispatched || !nativeComposerVisible()) {
      return null;
    }
    return guard;
  }

  function isControlledReplySubmitClick(event) {
    const target = event && event.target;
    if (!(target instanceof Element)) {
      return false;
    }
    const replyControl = target.closest("#reply-control");
    if (!replyControl || !nativeComposerVisible()) {
      return false;
    }
    const button = target.closest("button, .btn");
    return Boolean(button && replyControl.contains(button) && isNativeReplySubmitControl(button));
  }

  function isControlledReplySubmitKeydown(event) {
    if (!event || event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
      return false;
    }
    const target = event.target;
    return target instanceof Element && Boolean(target.closest("#reply-control"));
  }

  function isNativeReplySubmitControl(element) {
    if (!(element instanceof HTMLElement) || !isVisible(element)) {
      return false;
    }
    const text = String(element.textContent || "").replace(/\s+/g, " ").trim();
    const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`.trim();
    return (
      element.classList.contains("create") ||
      /^(reply|回复|发送)$/i.test(text) ||
      /^(reply|回复|发送)$/i.test(label) ||
      /Ctrl\s*Enter/i.test(label)
    );
  }

  async function submitControlledReaderReply(guard, raw) {
    const result = await createControlledReaderReply(guard, raw);
    const now = Date.now();
    guard.dispatched = true;
    guard.submittedUntil = now + READER_REPLY_SUBMIT_SUPPRESSION_MS;

    window.dispatchEvent(
      new CustomEvent(NATIVE_REPLY_SUBMITTED_EVENT, {
        detail: {
          topicId: guard.topicId,
          postNumber: guard.postNumber,
          submittedPostNumber: result.postNumber,
          topicPath: guard.topicPath,
          postUrl: guard.postUrl,
          submittedUrl: result.url
        }
      })
    );

    const composer = lookup("service:composer") || lookup("controller:composer");
    await discardExistingComposer(composer);
    window.setTimeout(() => {
      if (window.__linuxdoCardViewReplyNavigationGuard === guard) {
        window.__linuxdoCardViewReplyNavigationGuard = null;
      }
    }, READER_REPLY_SUBMIT_SUPPRESSION_MS);
  }

  async function createControlledReaderReply(guard, raw) {
    const payload = {
      raw,
      topic_id: guard.topicId
    };
    if (numeric(guard.postNumber) > 1) {
      payload.reply_to_post_number = numeric(guard.postNumber);
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest"
    };
    const csrfToken = csrfTokenFromPage() || (await csrfTokenFromSession());
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    const response = await fetch("/posts.json", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(payload)
    });
    const body = await safeJson(response);
    if (!response.ok) {
      throw new Error(postSubmitErrorFromPayload(body) || `Linux.do returned ${response.status}`);
    }

    const postNumber = numeric(modelGet(body, "post_number")) || numeric(modelGet(body, "post.post_number"));
    const postUrl =
      String(modelGet(body, "post_url") || modelGet(body, "url") || modelGet(body, "post.url") || "") ||
      (guard.topicPath && postNumber ? `${guard.topicPath}/${postNumber}` : guard.topicPath);
    return {
      postNumber,
      url: absoluteUrl(postUrl)
    };
  }

  function controlledReplyRaw() {
    const composer = lookup("service:composer") || lookup("controller:composer");
    const model = composer && (modelGet(composer, "model") || composer.model);
    const values = [
      modelGet(model, "reply"),
      modelGet(composer, "reply"),
      document.querySelector("#reply-control textarea")?.value,
      document.querySelector("#reply-control .d-editor-input")?.value
    ];

    for (const value of values) {
      const raw = String(value || "").trim();
      if (raw) {
        return raw;
      }
    }
    return "";
  }

  function setControlledReplySubmitting(submitting) {
    const replyControl = document.querySelector("#reply-control");
    if (!replyControl) {
      return;
    }
    for (const button of replyControl.querySelectorAll("button, .btn")) {
      if (isNativeReplySubmitControl(button)) {
        button.disabled = submitting;
        button.setAttribute("aria-busy", submitting ? "true" : "false");
      }
    }
  }

  function clearControlledReplySubmitError() {
    document.querySelector(`#reply-control .${CONTROLLED_REPLY_SUBMIT_ERROR_CLASS}`)?.remove();
  }

  function showControlledReplySubmitError(message) {
    const replyControl = document.querySelector("#reply-control");
    if (!replyControl) {
      return;
    }

    clearControlledReplySubmitError();
    const error = document.createElement("div");
    error.className = CONTROLLED_REPLY_SUBMIT_ERROR_CLASS;
    error.setAttribute("role", "alert");
    error.textContent = message;
    const submitPanel = replyControl.querySelector(".submit-panel") || replyControl;
    submitPanel.appendChild(error);
  }

  function controlledReplySubmitErrorMessage(error) {
    const message = String((error && error.message) || "").trim();
    return message || "回复提交失败，请稍后重试。";
  }

  function postSubmitErrorFromPayload(payload) {
    const errors = modelGet(payload, "errors");
    if (Array.isArray(errors) && errors.length) {
      return errors.map((item) => String(item || "").trim()).filter(Boolean).join(" ");
    }
    return String(modelGet(payload, "error") || modelGet(payload, "message") || "").trim();
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function csrfTokenFromPage() {
    return String(document.querySelector("meta[name='csrf-token']")?.getAttribute("content") || "").trim();
  }

  async function csrfTokenFromSession() {
    try {
      const response = await fetch("/session/csrf.json", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      });
      if (!response.ok) {
        return "";
      }
      return String(modelGet(await safeJson(response), "csrf") || "").trim();
    } catch {
      return "";
    }
  }

  async function runNativeBookmark(detail) {
    const currentUser = lookup("service:current-user") || lookup("current-user:main");
    const fallbackUrl = postUrlFromDetail(detail);
    const postId = numeric(detail.postId);

    if (!currentUser) {
      return nativeOutcome(false, "unsupported", "需要先登录后才能添加书签。", fallbackUrl);
    }
    if (!postId) {
      return nativeOutcome(false, "unsupported", "无法定位这条帖子的书签入口。", fallbackUrl);
    }
    if (detail.canBookmark === false && detail.bookmarked !== true) {
      return nativeOutcome(false, "unsupported", "当前账号没有添加书签权限，或需要先登录。", fallbackUrl);
    }
    const topic = await findNativeTopic(detail);
    if (!topic) {
      return nativeOutcome(false, "unsupported", "无法确认这条帖子的书签状态，请在原贴中重试。", fallbackUrl);
    }
    const existingBookmark = existingPostBookmark(topic, postId);

    const post = await findNativePost(topic, detail);
    if (!post) {
      return nativeOutcome(false, "unsupported", "无法定位这条帖子的原生书签入口，请在原贴中操作。", fallbackUrl);
    }
    const nativeBookmarked =
      Boolean(existingBookmark) || Boolean(modelGet(post, "bookmarked")) || Boolean(nativeBookmarkId(post, existingBookmark));
    if (detail.bookmarked === true && !nativeBookmarked && !nativeBookmarkAction(post)) {
      return nativeOutcome(false, "unsupported", "无法确认这条帖子的书签状态，请在原贴中重试。", fallbackUrl);
    }
    const bookmarked =
      detail.bookmarked === true || Boolean(existingBookmark) || Boolean(modelGet(post, "bookmarked")) || Boolean(numeric(modelGet(post, "bookmark_id")));

    const bookmarkAction = nativeBookmarkAction(post);
    if (bookmarkAction && nativeActionCanRun(bookmarkAction) && (await runNativeActionObject(bookmarkAction, post))) {
      return nativeOutcome(true, "success", bookmarked ? "已取消书签。" : "已添加为书签。", undefined, { acted: !bookmarked });
    }

    const managerResult = await runNativeBookmarkManager(post, bookmarked);
    if (managerResult === "success") {
      return nativeOutcome(true, "success", bookmarked ? "已取消书签。" : "已添加为书签。", undefined, { acted: !bookmarked });
    }
    if (managerResult === "failed") {
      return nativeOutcome(false, "error", "原生书签入口处理失败，请在原贴中操作。", fallbackUrl);
    }

    return nativeOutcome(false, "unsupported", "原生书签入口不可用，请在原贴中操作。", fallbackUrl);
  }

  function nativeCachedReplyTopicFromDetail(detail) {
    const topicId = numeric(detail.topicId);
    if (!topicId) {
      return null;
    }

    const topicController = lookup("controller:topic");
    const currentTopic = modelGet(topicController, "model");
    if (currentTopic && Number(modelGet(currentTopic, "id")) === topicId) {
      ensureTopicPathFromDetail(currentTopic, detail);
      return currentTopic;
    }

    const store = lookup("service:store") || lookup("store:main");
    if (store && isCallable(store, "peekRecord")) {
      try {
        const cachedTopic = store.peekRecord("topic", topicId);
        if (cachedTopic) {
          ensureTopicPathFromDetail(cachedTopic, detail);
          return cachedTopic;
        }
      } catch {
        // A cache miss should fall through to a local record, not a network request.
      }
    }

    return null;
  }

  function nativeTopicFromDetail(detail) {
    const topicId = numeric(detail.topicId);
    if (!topicId) {
      return null;
    }
    const topicLink = topicLinkFromDetail(detail, 0);

    return nativeRecord({
      id: topicId,
      title: String(detail.title || ""),
      fancy_title: String(detail.title || ""),
      slug: topicLink.slug,
      url: topicLink.topicPath,
      draft_key: String(detail.draftKey || "") || `topic_${topicId}`,
      draft_sequence: numericAllowZero(detail.draftSequence, 0),
      details: {
        can_create_post: detail.canReply === true
      },
      postStream: {
        posts: []
      },
      bookmarks: []
    });
  }

  function nativeReplyPostFromDetail(topic, detail) {
    const postId = numeric(detail.postId);
    const postNumber = numeric(detail.postNumber);
    const postStream = modelGet(topic, "postStream");
    const loaded = findLoadedPost(postStream, postId, postNumber);
    if (loaded) {
      ensurePostTopic(loaded, topic);
      return loaded;
    }

    if (!postId || !postNumber) {
      return null;
    }

    const topicLink = topicLinkFromDetail(detail, postNumber);
    const post = nativeRecord({
      id: postId,
      post_number: postNumber,
      post_number_int: postNumber,
      topic_id: numeric(detail.topicId),
      topic,
      topic_slug: topicLink.slug,
      topic_url: topicLink.topicPath,
      post_url: topicLink.postPath,
      url: topicLink.postPath,
      username: String(detail.username || ""),
      avatar_template: String(detail.avatarUrl || ""),
      liked: detail.liked === true
    });
    ensurePostTopic(post, topic);
    return post;
  }

  function nativeRecord(values) {
    const data = { ...values };
    return {
      ...data,
      get(key) {
        return plainGet(data, key);
      },
      set(key, value) {
        plainSet(data, key, value);
        plainSet(this, key, value);
      },
      getProperties(...keys) {
        return keys.flat().reduce((properties, key) => {
          properties[key] = plainGet(data, key);
          return properties;
        }, {});
      }
    };
  }

  function nativeBookmarkAction(post) {
    return (
      modelGet(post, "bookmarkAction") ||
      modelGet(post, "actionByName.bookmark") ||
      modelGet(post, "actionByName.bookmarkPost") ||
      modelGet(post, "actionsByName.bookmark") ||
      modelGet(post, "actionsByName.bookmarkPost")
    );
  }

  function nativeBookmarkId(post, existingBookmark) {
    return (
      numeric(modelGet(existingBookmark, "id")) ||
      numeric(modelGet(post, "bookmark_id")) ||
      numeric(modelGet(post, "bookmarkId")) ||
      numeric(modelGet(post, "bookmark.id"))
    );
  }

  function nativeActionCanRun(action) {
    return ![
      modelGet(action, "canToggle"),
      modelGet(action, "can_act"),
      modelGet(action, "canAct"),
      modelGet(action, "canCreate"),
      modelGet(action, "can_create")
    ].some(isExplicitFalse);
  }

  function nativeLikeActionCanRun(action) {
    const canToggle = modelGet(action, "canToggle");
    if (isExplicitFalse(canToggle)) {
      return false;
    }
    if (isExplicitTrue(canToggle)) {
      return true;
    }

    const capabilityValues = [
      modelGet(action, "can_act"),
      modelGet(action, "can_undo"),
      modelGet(action, "canAct"),
      modelGet(action, "canUndo")
    ];
    if (capabilityValues.some(isExplicitTrue)) {
      return true;
    }
    if (capabilityValues.some(isExplicitFalse)) {
      return false;
    }
    return isCallable(action, "togglePromise") || isCallable(action, "act");
  }

  async function runNativeActionObject(action, post) {
    for (const method of ["togglePromise", "toggle", "act"]) {
      if (isCallable(action, method)) {
        await action[method](post);
        return true;
      }
    }

    return false;
  }

  async function runNativeBookmarkManager(post, bookmarked) {
    const module = requireModule("discourse/lib/post-bookmark-manager");
    const PostBookmarkManager = moduleDefault(module);
    if (typeof PostBookmarkManager !== "function") {
      return "unavailable";
    }

    const owner = nativeOwnerFromPageContext(post);
    if (!owner) {
      return "unavailable";
    }

    const topic = modelGet(post, "topic");
    const topicController = lookup("controller:topic");
    const previousTopic = topicController ? modelGet(topicController, "model") : null;
    const shouldBindTopic =
      topicController && topic && numeric(modelGet(topic, "id")) && numeric(modelGet(previousTopic, "id")) !== numeric(modelGet(topic, "id"));

    try {
      if (shouldBindTopic) {
        modelSet(topicController, "model", topic);
      }
      const manager = new PostBookmarkManager(owner, post);
      if (!isCallable(manager, bookmarked ? "delete" : "create")) {
        return "unavailable";
      }
      if (shouldBindTopic && topicController) {
        manager.topicController = topicController;
      }
      if (bookmarked) {
        const bookmarkId =
          numeric(modelGet(manager, "trackedBookmark.id")) ||
          numeric(modelGet(manager, "bookmarkModel.id")) ||
          nativeBookmarkId(post, null);
        if (!bookmarkId) {
          return "unavailable";
        }
        const deleteResponse = await manager.delete();
        if (isCallable(manager, "afterDelete")) {
          manager.afterDelete(deleteResponse || {}, bookmarkId);
        }
      } else {
        await manager.create();
      }
      return "success";
    } catch {
      return "failed";
    } finally {
      if (shouldBindTopic) {
        modelSet(topicController, "model", previousTopic);
      }
    }
  }

  function moduleDefault(module) {
    return module && module.default ? module.default : module;
  }

  function nativeOwnerFromPageContext(...models) {
    const ownerModule = requireModule("@ember/owner");
    const getOwner = ownerModule && (ownerModule.getOwner || moduleDefault(ownerModule));
    const topicController = lookup("controller:topic");
    const candidates = [topicController, ...models].filter(Boolean);

    if (typeof getOwner === "function") {
      for (const candidate of candidates) {
        try {
          const owner = getOwner(candidate);
          if (owner) {
            return owner;
          }
        } catch {
          // Try the next candidate or container fallback.
        }
      }
    }

    const container = knownContainers()[0];
    return (container && (container.owner || container)) || null;
  }

  function isExplicitFalse(value) {
    return value === false || value === "false";
  }

  function isExplicitTrue(value) {
    return value === true || value === "true";
  }

  function confirmedBoolean(value) {
    if (value === true || value === "true") {
      return true;
    }
    if (value === false || value === "false") {
      return false;
    }
    return null;
  }

  async function findNativeTopic(detail) {
    const topicId = numeric(detail.topicId);
    if (!topicId) {
      return null;
    }

    const topicController = lookup("controller:topic");
    const currentTopic = modelGet(topicController, "model");
    if (currentTopic && Number(modelGet(currentTopic, "id")) === topicId) {
      return currentTopic;
    }

    const store = lookup("service:store") || lookup("store:main");
    if (store && isCallable(store, "find")) {
      try {
        const topic = await store.find("topic", topicId);
        if (topic) {
          return topic;
        }
      } catch {
        // Fall through to the static Topic loader if this Discourse build exposes it.
      }
    }

    const topicModule = requireModule("discourse/models/topic") || {};
    const Topic = topicModule.default || topicModule;
    if (isCallable(Topic, "find")) {
      const topicJson = await Topic.find(topicId, {});
      if (store && isCallable(store, "createRecord")) {
        return store.createRecord("topic", topicJson);
      }
      return topicJson;
    }

    return null;
  }

  async function findNativePost(topic, detail) {
    const postId = numeric(detail.postId);
    const postNumber = numeric(detail.postNumber);
    const postStream = modelGet(topic, "postStream");
    const store = lookup("service:store") || lookup("store:main");

    const loaded = findLoadedPost(postStream, postId, postNumber);
    if (loaded) {
      ensurePostTopic(loaded, topic);
      return loaded;
    }

    if (postId && isCallable(topic, "postById")) {
      try {
        const post = await topic.postById(postId);
        if (post) {
          ensurePostTopic(post, topic);
          return post;
        }
      } catch {
        // Try the lower-level store fallback next.
      }
    }

    if (postNumber && postStream && isCallable(postStream, "loadPostByPostNumber")) {
      try {
        const post = await postStream.loadPostByPostNumber(postNumber);
        if (post) {
          ensurePostTopic(post, topic);
          return post;
        }
      } catch {
        // Try the lower-level store fallback next.
      }
    }

    if (postId && store && isCallable(store, "find")) {
      try {
        const post = await store.find("post", postId);
        if (post) {
          ensurePostTopic(post, topic);
          return post;
        }
      } catch {
        // The caller will report unsupported.
      }
    }

    return null;
  }

  function findLoadedPost(postStream, postId, postNumber) {
    if (!postStream) {
      return null;
    }

    if (postId && isCallable(postStream, "findLoadedPost")) {
      const post = postStream.findLoadedPost(postId);
      if (post) {
        return post;
      }
    }

    const posts = arrayFrom(modelGet(postStream, "posts"));
    return (
      posts.find((post) => Number(modelGet(post, "id")) === postId || Number(modelGet(post, "post_number")) === postNumber) ||
      null
    );
  }

  function existingPostBookmark(topic, postId) {
    return (
      arrayFrom(modelGet(topic, "bookmarks")).find(
        (bookmark) =>
          Number(modelGet(bookmark, "bookmarkable_id")) === postId &&
          String(modelGet(bookmark, "bookmarkable_type")) === "Post"
      ) || null
    );
  }

  function ensurePostTopic(post, topic) {
    if (!modelGet(post, "topic")) {
      modelSet(post, "topic", topic);
    }
    ensurePostTopicPath(post, topic);
    ensurePostActionRuntime(post);
  }

  function ensureTopicPathFromDetail(topic, detail) {
    const topicLink = topicLinkFromDetail(detail, 0);
    if (!modelGet(topic, "slug")) {
      modelSet(topic, "slug", topicLink.slug);
    }
    if (!modelGet(topic, "url") && topicLink.topicPath) {
      modelSet(topic, "url", topicLink.topicPath);
    }
  }

  function ensurePostTopicPath(post, topic) {
    const topicId = numeric(modelGet(topic, "id")) || numeric(modelGet(post, "topic_id"));
    const postNumber = numeric(modelGet(post, "post_number")) || numeric(modelGet(post, "post_number_int"));
    const topicLink =
      topicLinkFromUrl(modelGet(topic, "url"), topicId, postNumber) ||
      topicLinkFromUrl(modelGet(post, "topic_url"), topicId, postNumber);
    const slug = String(modelGet(topic, "slug") || modelGet(post, "topic_slug") || (topicLink && topicLink.slug) || "topic");
    const topicPath = String(
      (topicLink && topicLink.topicPath) || modelGet(topic, "url") || modelGet(post, "topic_url") || (topicId ? `/t/${slug}/${topicId}` : "")
    );
    const postPath = String(
      (topicLink && topicLink.postPath) || modelGet(post, "url") || modelGet(post, "post_url") || (topicPath && postNumber ? `${topicPath}/${postNumber}` : "")
    );

    if (!modelGet(topic, "slug")) {
      modelSet(topic, "slug", slug);
    }
    if (!modelGet(topic, "url") && topicPath) {
      modelSet(topic, "url", topicPath);
    }
    if (!modelGet(post, "topic_slug")) {
      modelSet(post, "topic_slug", slug);
    }
    if (!modelGet(post, "topic_url") && topicPath) {
      modelSet(post, "topic_url", topicPath);
    }
    if (!modelGet(post, "post_url") && postPath) {
      modelSet(post, "post_url", postPath);
    }
    if (!modelGet(post, "url") && postPath) {
      modelSet(post, "url", postPath);
    }
  }

  function ensurePostActionRuntime(post) {
    if (!post || (typeof post !== "object" && typeof post !== "function")) {
      return;
    }
    if (!isCallable(post, "get")) {
      post.get = function (key) {
        return plainGet(this, key);
      };
    }
    if (!isCallable(post, "set")) {
      post.set = function (key, value) {
        plainSet(this, key, value);
      };
    }
    if (!isCallable(post, "getProperties")) {
      post.getProperties = function (...keys) {
        return keys.reduce((properties, key) => {
          properties[key] = plainGet(this, key);
          return properties;
        }, {});
      };
    }
    if (!isCallable(post, "updateActionsSummary")) {
      post.updateActionsSummary = function (summary) {
        const likeAction = modelGet(this, "likeAction") || modelGet(this, "actionByName.like");
        const acted = confirmedBoolean(modelGet(summary, "acted")) ?? confirmedBoolean(modelGet(likeAction, "acted"));
        if (acted !== null) {
          modelSet(this, "liked", acted);
          if (likeAction) {
            modelSet(likeAction, "acted", acted);
          }
        }
      };
    }
  }

  function nativeOutcome(ok, status, message, fallbackUrl, extra) {
    return {
      ok,
      status,
      message,
      fallbackUrl,
      ...(extra || {})
    };
  }

  function postUrlFromDetail(detail) {
    const url = String(detail.postUrl || detail.topicUrl || "").trim();
    if (!url) {
      return "";
    }
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  function topicLinkFromDetail(detail, postNumber) {
    const topicId = numeric(detail.topicId);
    return (
      topicLinkFromUrl(detail.topicUrl, topicId, postNumber) ||
      topicLinkFromUrl(detail.postUrl, topicId, postNumber) ||
      fallbackTopicLink(topicId, postNumber)
    );
  }

  function topicLinkFromUrl(value, expectedTopicId, postNumber) {
    const path = urlPath(value);
    if (!path) {
      return null;
    }
    const match = path.match(/^\/[tn]\/([^/]+)\/(\d+)(?:\/\d+)?$/);
    if (!match) {
      return null;
    }
    const topicId = numeric(match[2]);
    if (!topicId || (expectedTopicId && topicId !== expectedTopicId)) {
      return null;
    }
    const slug = match[1] || "topic";
    const id = expectedTopicId || topicId;
    const topicPath = `/t/${slug}/${id}`;
    return {
      slug,
      topicPath,
      postPath: postNumber ? `${topicPath}/${postNumber}` : topicPath
    };
  }

  function fallbackTopicLink(topicId, postNumber) {
    const slug = "topic";
    const topicPath = topicId ? `/t/${slug}/${topicId}` : "";
    return {
      slug,
      topicPath,
      postPath: topicPath && postNumber ? `${topicPath}/${postNumber}` : topicPath
    };
  }

  function urlPath(value) {
    const url = String(value || "").trim();
    if (!url) {
      return "";
    }
    try {
      return new URL(url, window.location.origin).pathname.replace(/\/+$/, "");
    } catch {
      return url.split(/[?#]/)[0].replace(/\/+$/, "");
    }
  }

  function postNumberFromTopicUrl(value, expectedTopicId) {
    const path = urlPath(value);
    if (!path) {
      return 0;
    }
    const match = path.match(/^\/[tn]\/[^/]+\/(\d+)(?:\/(\d+))?$/);
    if (!match) {
      return 0;
    }
    const topicId = numeric(match[1]);
    if (!topicId || (expectedTopicId && topicId !== expectedTopicId)) {
      return 0;
    }
    return numeric(match[2]);
  }

  function routePath(value) {
    const url = String(value || "").trim();
    if (!url) {
      return "";
    }
    try {
      const parsed = new URL(url, window.location.origin);
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    } catch {
      return url.startsWith("/") ? url : "";
    }
  }

  function restoreDiscourseRoute(returnUrl) {
    const path = routePath(returnUrl);
    if (!path) {
      return false;
    }
    if (routePath(window.location.href) === path) {
      return true;
    }

    const router = lookup("router:main");
    if (router && isCallable(router, "transitionTo")) {
      try {
        const transition = router.transitionTo(path);
        if (transition && isCallable(transition, "catch")) {
          transition.catch(() => {});
        }
        return true;
      } catch {
        // Fall back to history replacement below.
      }
    }

    try {
      history.replaceState(history.state, "", path);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      return true;
    } catch {
      return false;
    }
  }

  function armReaderReplyNavigationGuard(detail) {
    const topicId = numeric(detail.topicId);
    const postNumber = numeric(detail.postNumber);
    const topicLink = topicLinkFromDetail(detail, 0);
    if (!topicId || !topicLink.topicPath) {
      return;
    }

    window.__linuxdoCardViewReplyNavigationGuard = {
      topicId,
      postNumber,
      topicPath: topicLink.topicPath,
      postUrl: postUrlFromDetail(detail),
      returnUrl: routePath(detail.returnUrl) || routePath(window.location.href),
      expiresAt: Date.now() + READER_REPLY_NAVIGATION_GUARD_MS,
      submittedUntil: 0,
      dispatched: false
    };
  }

  function suppressReaderReplyNavigation(url) {
    const guard = window.__linuxdoCardViewReplyNavigationGuard;
    if (!guard) {
      return false;
    }
    const now = Date.now();
    if (now > guard.expiresAt) {
      window.__linuxdoCardViewReplyNavigationGuard = null;
      return false;
    }

    const path = urlPath(url);
    if (!path || !sameTopicPath(path, guard.topicPath)) {
      return false;
    }

    if (!guard.dispatched) {
      guard.dispatched = true;
      guard.submittedUntil = now + READER_REPLY_SUBMIT_SUPPRESSION_MS;
      window.dispatchEvent(
        new CustomEvent(NATIVE_REPLY_SUBMITTED_EVENT, {
          detail: {
            topicId: guard.topicId,
            postNumber: guard.postNumber,
            submittedPostNumber: postNumberFromTopicUrl(url, guard.topicId),
            topicPath: guard.topicPath,
            postUrl: guard.postUrl,
            submittedUrl: absoluteUrl(url)
          }
        })
      );
      window.setTimeout(() => {
        if (window.__linuxdoCardViewReplyNavigationGuard === guard) {
          window.__linuxdoCardViewReplyNavigationGuard = null;
        }
      }, READER_REPLY_SUBMIT_SUPPRESSION_MS);
    }

    scheduleReaderReplyRouteRestore(guard);

    return now <= guard.submittedUntil;
  }

  function scheduleReaderReplyRouteRestore(guard) {
    if (!guard || !guard.returnUrl || guard.routeRestoreScheduled) {
      return;
    }

    guard.routeRestoreScheduled = true;
    guard.routeRestoreToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    document.documentElement.classList.add(READER_REPLY_ROUTE_RESTORING_CLASS);

    for (const delay of READER_REPLY_ROUTE_RESTORE_DELAYS) {
      window.setTimeout(() => {
        if (window.__linuxdoCardViewReplyNavigationGuard !== guard) {
          return;
        }
        restoreDiscourseRoute(guard.returnUrl);
      }, delay);
    }

    const token = guard.routeRestoreToken;
    window.setTimeout(() => {
      const currentGuard = window.__linuxdoCardViewReplyNavigationGuard;
      if (!currentGuard || currentGuard === guard || currentGuard.routeRestoreToken === token) {
        document.documentElement.classList.remove(READER_REPLY_ROUTE_RESTORING_CLASS);
      }
    }, READER_REPLY_ROUTE_RESTORE_DELAYS[READER_REPLY_ROUTE_RESTORE_DELAYS.length - 1] + 600);
  }

  function sameTopicPath(path, topicPath) {
    const normalizedPath = String(path || "").replace(/\/+$/, "");
    const normalizedTopicPath = String(topicPath || "").replace(/\/+$/, "");
    return normalizedPath === normalizedTopicPath || normalizedPath.startsWith(`${normalizedTopicPath}/`);
  }

  function absoluteUrl(value) {
    const url = String(value || "").trim();
    if (!url) {
      return "";
    }
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  async function discardExistingComposer(composer) {
    if (!composer || typeof composer !== "object") {
      return;
    }

    if (isCallable(composer, "destroyDraft")) {
      try {
        await composer.destroyDraft();
      } catch {
        // Keep going so the replacement can still clear the local composer state.
      }
    }

    const model = composer.model;
    if (isCallable(model, "clearState")) {
      try {
        model.clearState();
      } catch {
        // A stale model should not prevent replacing the composer content.
      }
    }

    if (isCallable(composer, "close")) {
      try {
        composer.close();
      } catch {
        // The next open call can still replace a closed or partially reset composer.
      }
    }
  }

  function closeNativePrivateMessage() {
    if (clickNativeComposerClose()) {
      return true;
    }

    const composer = lookup("service:composer") || lookup("controller:composer");
    for (const method of ["close", "closeComposer"]) {
      if (isCallable(composer, method)) {
        composer[method]();
        return true;
      }
    }

    return false;
  }

  function clickNativeComposerClose() {
    const replyControl = document.querySelector("#reply-control");
    if (!replyControl) {
      return false;
    }

    const directClose = replyControl.querySelector(
      "button.close, .btn.close, button[aria-label='Close'], button[aria-label='关闭'], button[title='Close'], button[title='关闭']"
    );
    if (directClose instanceof HTMLElement) {
      directClose.click();
      return true;
    }

    const closeControl = Array.from(replyControl.querySelectorAll("button, a")).find(
      (element) => element instanceof HTMLElement && isVisible(element) && isExplicitCloseControl(element)
    );

    if (closeControl instanceof HTMLElement) {
      closeControl.click();
      return true;
    }

    return false;
  }

  function nativeComposerVisible() {
    const replyControl = document.querySelector("#reply-control");
    if (!replyControl) {
      return false;
    }

    return isVisible(replyControl) && !replyControl.classList.contains("closed");
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function isExplicitCloseControl(element) {
    const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`.trim();
    const text = String(element.textContent || "").trim();
    return /^(close|关闭)$/i.test(label) || text === "×";
  }

  function lookup(key) {
    for (const container of knownContainers()) {
      if (!isCallable(container, "lookup")) {
        continue;
      }
      try {
        const value = container.lookup(key);
        if (value && typeof value === "object") {
          return value;
        }
      } catch {
        // Try the next known container shape.
      }
    }

    return null;
  }

  function knownContainers() {
    const discourse = window.Discourse;
    return [discourse && discourse.__container__, window.__container__].filter(Boolean);
  }

  function requireModule(name) {
    const requireFn = window.require || window.requirejs;
    if (typeof requireFn !== "function") {
      return undefined;
    }

    try {
      return requireFn(name);
    } catch {
      return undefined;
    }
  }

  function isCallable(value, key) {
    return Boolean(value && (typeof value === "object" || typeof value === "function") && typeof value[key] === "function");
  }

  function modelGet(model, key) {
    if (!model || (typeof model !== "object" && typeof model !== "function")) {
      return undefined;
    }
    if (isCallable(model, "get")) {
      try {
        return model.get(key);
      } catch {
        // Fall back to plain property access.
      }
    }
    return String(key)
      .split(".")
      .reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), model);
  }

  function modelSet(model, key, value) {
    if (!model || (typeof model !== "object" && typeof model !== "function")) {
      return;
    }
    if (isCallable(model, "set")) {
      try {
        model.set(key, value);
        return;
      } catch {
        // Fall back to plain property assignment.
      }
    }
    model[key] = value;
  }

  function plainGet(model, key) {
    return String(key)
      .split(".")
      .reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), model);
  }

  function plainSet(model, key, value) {
    const parts = String(key).split(".");
    const last = parts.pop();
    if (!last) {
      return;
    }
    const target = parts.reduce((current, part) => {
      if (!current[part] || typeof current[part] !== "object") {
        current[part] = {};
      }
      return current[part];
    }, model);
    target[last] = value;
  }

  function arrayFrom(value) {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (isCallable(value, "toArray")) {
      return value.toArray();
    }
    if (typeof value[Symbol.iterator] === "function") {
      return Array.from(value);
    }
    return [];
  }

  function numeric(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function numericAllowZero(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function patchHistory(method) {
    const original = history[method];
    if (original && original.__linuxDoCardViewPatched) {
      return;
    }

    function patchedHistoryMethod(data, unused, url) {
      if (suppressReaderReplyNavigation(url)) {
        return undefined;
      }
      const result = original.call(this, data, unused, url);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      return result;
    }
    patchedHistoryMethod.__linuxDoCardViewPatched = true;
    history[method] = patchedHistoryMethod;
  }
})();
