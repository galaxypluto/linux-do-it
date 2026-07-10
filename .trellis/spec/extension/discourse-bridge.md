# Discourse Bridge

This guide owns Linux.do/Discourse write-like contracts for Reader and the page bridge.

Reference files:

- `public/pageBridge.js`
- `src/content/privateMessageBridge.ts`
- `src/content/mount.ts`
- `src/content/readerState.ts`
- `src/discourse/api.ts`
- `tests/content/privateMessageBridge.test.ts`
- `tests/discourse/api-reader.test.ts`
- `tests/content/readerState.test.ts`
- `docs/notes/` (regression notes when present)

## Reader-Originated Native Reply Submit

### 1. Scope / Trigger

- Trigger: Reader opens the Linux.do/Discourse native composer and the user submits through the native reply button or `Ctrl/Cmd+Enter`.
- Flow: page bridge controlled submit -> content Reader state -> background storage/activity -> side panel activity feed.
- The native composer is used for input and editing only. Reader-originated submit must be controlled by the page bridge so Discourse does not render the submitted topic into `#main-outlet`.

### 2. Signatures

- Page bridge controlled submit endpoint: `POST /posts.json`.
- Request body:
  - `raw: string`
  - `topic_id: number`
  - `reply_to_post_number?: number`, only when replying to a post number greater than `1`
- Request headers:
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `X-Requested-With: XMLHttpRequest`
  - `X-CSRF-Token` from page metadata or fallback `GET /session/csrf.json`
- Success event: `NATIVE_REPLY_SUBMITTED_EVENT`.
- Event detail:
  - `topicId: number`
  - `postNumber: number` for the target post being replied to
  - `topicPath: string`
  - `postUrl: string`
  - `submittedPostNumber?: number` parsed from the `/posts.json` response URL or post number
  - `submittedUrl?: string`

### 3. Contracts

- Keep the visible route on the current list route such as `/posted`.
- Capture the native submit click and `Ctrl/Cmd+Enter` while `window.__linuxdoCardViewReplyNavigationGuard` is active.
- Call `event.preventDefault()`, `event.stopPropagation()`, and `event.stopImmediatePropagation()` before starting controlled submit.
- Do not let Discourse's native submit handler navigate to or render `/t/...` as the primary success path.
- On success, dispatch `NATIVE_REPLY_SUBMITTED_EVENT`, then close and clear the native composer.
- On failure, keep the composer open, re-enable the submit button, and surface a retryable error near the submit panel.
- Native reply route restore is only a fallback for unexpected native navigation, not the normal path.
- If `submittedPostNumber` is available, fetch a post-number topic JSON payload and merge only the submitted reply into current Reader data.
- If the submitted reply cannot be located, keep existing Reader data and show a feedback link to the submitted native URL when available.
- Side panel renders extension-owned activity cards only. Do not iframe or copy Linux.do native DOM into the side panel.

### 4. Validation & Error Matrix

- Empty composer raw text -> do not call `/posts.json`; show a local empty-post error.
- Missing CSRF token -> try `/session/csrf.json`; if still missing, attempt the write without falsely reporting success.
- `/posts.json` non-2xx -> keep composer open and show the server error.
- Missing `topicId` or mismatched active Reader topic -> ignore the submitted event.
- Missing `submittedPostNumber` -> do not full-refresh Reader; record a sent activity and expose the native URL if available.
- Submitted post absent from post-number payload -> keep existing Reader data and expose the native URL.
- Fetch abort -> stop silently.
- Fetch failure -> keep existing Reader data, record sent activity, and expose the native URL.

### 5. Good / Base / Bad Cases

- Good: native composer submit is captured, page bridge posts to `/posts.json`, Reader fetches `/t/.../:submittedPostNumber.json`, merges only that reply, highlights it, and records a synced side panel activity. The URL remains `/posted` or the active list route.
- Base: controlled submit succeeds but the payload cannot locate the new post; Reader stays open and provides an explicit native link.
- Bad: Reader-originated submit allows Discourse's native submit handler to run, triggers a full topic/list refresh, calls `router.transitionTo` while already on the return route, opens an inactive background tab, injects Linux.do native topic DOM into side panel, or replaces the Reader background with `#main-outlet` topic content.

### 6. Tests Required

- Unit test Reader-originated submit posts to `/posts.json` and does not change `window.location`.
- Unit test composer target links such as `title="回复话题"` are not mistaken for submit controls.
- Unit test controlled submit closes and clears the composer only after successful `/posts.json`.
- Unit test controlled submit failure leaves the composer open and displays an error.
- Unit test route restore no-ops when the current URL is already the return route.
- Unit test same-list route watcher refresh is ignored during the native reply restore window.
- Live QA only when the task requires real authenticated write behavior.

### 7. Wrong vs Correct

Wrong:

```typescript
await composer.open({ action: "reply", topic });
// Then allow Discourse's native create button to submit and navigate/render /t/...
```

Correct:

```typescript
event.preventDefault();
event.stopImmediatePropagation();
const result = await postReaderReplyViaPostsJson(guard, raw);
dispatchNativeReplySubmitted(result);
void syncSubmittedNativeReply(result);
```

## Reader Read Timing Sync

- Trigger: Reader code writes Linux.do/Discourse account read state from the content runtime.
- Treat this as a write-like server mutation even though it supports a read workflow.
- API helper: `syncTopicReadTimings(reader, { postNumbers, signal })`.
- Endpoint: `POST /t/:topic_id/timings`.
- Request body fields:
  - `topic_id`: numeric Discourse topic id.
  - `topic_time`: bounded milliseconds for this sync batch.
  - `timings`: object keyed by post number string, value is milliseconds.
- Only post numbers already loaded into Reader state may be sent.
- Topic list normalization must map Discourse read progress fields such as `last_read_post_number`, `highest_post_number`, `unread_posts`, and `new_posts` into `TopicCardData.flags.read`.
- Extension-local viewed markers may be promoted from read timing sync only after the timing request returns 2xx.
- Bad case: background polling, cache refresh, or unopened topic cards mark posts as read.

Tests required:

- Payload construction for selected loaded post numbers.
- Timing POST headers/body including CSRF.
- Server read-progress normalization for fully read and unread topics.

## Reader Poll Vote State

- Trigger: Reader sanitized cooked HTML exposes a poll option button and the user clicks it.
- Treat this as a write-like server mutation.
- Endpoint: `PUT /polls/vote`.
- Request body:
  - `post_id`: numeric Discourse post id.
  - `poll_name`: poll identifier, usually `poll`.
  - `options`: selected option id array.
- Headers match other Discourse write-like calls: JSON content type, `X-Requested-With`, and `X-CSRF-Token` when available.
- Missing post id, poll name, or option id -> do not call the endpoint.
- Non-2xx response -> keep Reader open and surface a retryable Reader error.
- Success -> surface explicit Reader success, mark the selected option locally, apply returned poll counts immediately, then refresh Reader data.

Tests required:

- Poll vote request method, endpoint, headers, and body.
- Sanitized poll buttons dispatch the typed vote request.
- Success feedback updates selected state, voter count, option counts, and progress bars from server response.

## Other Native Write-Like Actions

- Private message, like, bookmark, reply, flag, read timing, and poll vote are all write-like actions.
- Local Reader state may only show success after the native/page bridge/API boundary reports success.
- Failure must surface local feedback and must not mutate Reader state as if the server accepted the write.

## Scenario: Reader native Flag modal (post only)

### 1. Scope / Trigger

- Trigger: Reader `PostAction` with `action="flag"` opens Discourse's native Flag UI above the Reader overlay.
- Boost / short-reply flag is **out of scope** for the Reader; do not reintroduce a custom `ReportModal` or `flag-boost` bridge path unless product scope changes.

### 2. Signatures

- Content request: `requestNativePostAction({ action: "flag", topicId, postId, postNumber, postUrl, ... })`.
- Page bridge: `runNativeFlag(detail)` in `public/pageBridge.js`.
- Modules: `discourse/components/modal/flag` + `discourse/lib/flag-targets/post-flag`.
- Elevate class: `ldcv-elevate-native-modal` (`NATIVE_MODAL_ELEVATE_CLASS` in `src/content/pageStyle.ts`).

### 3. Contracts

- Pending feedback label must be `举报窗口`（via `readerPostActionLabel("flag")`）, never fall through to `书签`.
- On open success, return `opened` / message `已打开举报窗口。` and keep `fallbackUrl` so the success strip can link `打开原生视图`.
- Before `modal.show`, add `html.ldcv-elevate-native-modal`; remove it when the native modal DOM is gone (MutationObserver after a short mount delay).
- Reader z-index is ~`2147483646`; elevated native modal/backdrop must sit at or above that while the class is active.
- Do not implement Reader-owned flag reason lists or `POST /post_actions` for the happy path; the native modal owns submit.

### 4. Validation & Error Matrix

- Missing FlagModal / PostFlag / `modal.show` -> `unsupported` + fallback URL.
- Not logged in -> `unsupported`「请先登录后再举报。」
- Cannot resolve native topic/post -> `unsupported`「无法定位这条帖子的举报入口。」
- `modal.show` throws -> `error`「打开举报窗口失败…」

### 5. Good / Base / Bad Cases

- Good: click flag → pending「举报窗口处理中…」→ native Flag modal visible above Reader → success strip with same-color「打开原生视图」link.
- Base: native modules unavailable → unsupported feedback + native URL, Reader stays open.
- Bad: custom in-Reader ReportModal under Reader z-index; pending label shows「书签处理中」; boost bubble opens a broken `flag-boost` path.

### 6. Tests Required

- Unit: `readerPostActionLabel("flag")` / template feedback link class.
- Bridge/live QA: flag opens native modal while Reader remains mounted; elevate class clears after close.

### 7. Wrong vs Correct

#### Wrong
```javascript
// Custom modal inside Reader shadow root at z-50
modal.show(CustomReportModal, { reasons: hardcodedFlags });
```

#### Correct
```javascript
modal.show(FlagModal, { model: { flagTarget: new PostFlag(), flagModel: post, setHidden } });
document.documentElement.classList.add("ldcv-elevate-native-modal");
```

## Scenario: discourse-boosts in Reader

### 1. Scope / Trigger

- Trigger: Topic JSON posts include `boosts` / `can_boost`; Reader renders pills and create/delete flows.
- Cache: bump `READER_CACHE_VERSION` whenever post shape gains boost fields.

### 2. Signatures

- `createBoost(postId, raw)` → `POST /discourse-boosts/posts/{postId}/boosts` body `{ raw }`
- `deleteBoost(boostId)` → `DELETE /discourse-boosts/boosts/{boostId}`
- `fetchBoost(boostId)` → `GET /discourse-boosts/boosts/{boostId}`（补全 `can_delete`）
- Normalize via `normalizeBoosts` + `sanitizeCookedHtml` on `cooked`.

### 3. Contracts

- Topic-embedded boosts often omit `can_delete`; treat `null` as unknown and fetch before showing delete.
- After deleting own boost, restore `canBoost` so the add entry returns.
- Do not sync optimistic local boosts away solely because `initialBoosts` array identity changed; key off post id + boost id set.
- Reader does **not** ship boost flag UI.

### 4. Validation & Error Matrix

- Missing CSRF → throw; UI rolls back optimistic bubble / delete.
- Create/delete non-2xx → rollback + inline error string.
- `fetchBoost` failure → do not open delete menu.

### 5. Good / Base / Bad Cases

- Good: empty `can_boost` shows toolbar rocket; submit optimistic pill; refresh keeps server boost; delete restores add entry.
- Base: permissions unknown until click; fetch then show delete only.
- Bad: coerce missing `can_delete` to `false` and hide all interaction; delete without restoring `canBoost`.

### 6. Tests Required

- API normalize: boosts array, missing id not collapsed to `0`, cooked sanitized.
- UI/live QA: create, delete, re-add; no boost flag entry.

### 7. Wrong vs Correct

#### Wrong
```typescript
canDelete: confirmedBoolean(boost.can_delete) ?? false; // unknown becomes false → never fetch
```

#### Correct
```typescript
canDelete: confirmedBoolean(boost.can_delete); // null => fetchBoost before menu
```
