# Content And Bridge

This document covers how the extension injects itself into the host page (Linux.do / Discourse) and communicates with it.

## Content Script Lifecycle (`src/content/mount.ts`)

The primary entry point `bootCardView()` initializes the extension environment.

### Boot Sequence
1. Check `RUNTIME_ATTR` to prevent double-initialization.
2. Load settings and cached view state (`loadSettings()`).
3. Apply page-level style adjustments (`ensurePageStyle()`).
4. Establish the bridge to the host context (`ensurePageBridge()`).
5. Route-based mounting: Check `parseLinuxDoNestedTopicRoute` and `parseLinuxDoTopicRoute` to determine what UI to render.

## Native Bridge (`src/content/nativeBridge.ts` / `privateMessageBridge.ts`)

Because Chrome extensions run in an isolated world, we must use a page bridge to interact with Discourse's native JavaScript objects (like the Composer or Private Message routing).

### Rules for the Bridge
- **Event Passing**: Use `window.postMessage` or CustomEvents with specific, namespaced event names (e.g., `NATIVE_REPLY_SUBMITTED_EVENT`).
- **State Restoration**: Functions like `restoreNativeReplyListRouteIfNeeded` are critical for maintaining the illusion of a seamless SPA when the user closes our reader.

## Scenario: Sidepanel search enhancer uses typed content-script messages

### 1. Scope / Trigger
- Trigger: `entrypoints/sidepanel/App.tsx` needs Linux.do logged-in page context for search and Reader opening, so it sends tab-scoped messages to `src/content/mount.ts`.

### 2. Signatures
- Shared schema: `SidePanelContentMessage` in `src/shared/messaging/messages.ts`.
- Search request: `{ type: "ldcv.searchTopics"; query: string; page?: number }`.
- Open request: `{ type: "ldcv.openTopic"; topicId: number; topic: TopicCardData }`.
- Response: `{ ok: true; data?: unknown } | { ok: false; error: string }`.

### 3. Contracts
- Sidepanel must create messages through the shared schema, not ad hoc string payloads.
- Content script must validate raw messages before reading payload fields.
- Search runs from the content-script/page context using `/search.json?q=...&page=N` with included credentials.
- Sidepanel infinite scroll must request the next page only while `grouped_search_result.more_full_page_results` / `more_posts` or the page-size fallback indicates more results.
- End-of-results UI must stop further automatic requests and display `已经到底了哦~`.
- Topic open must use `modalOrigin: null` unless a real `ReaderModalOrigin` object is available from a DOM card.

### 4. Validation & Error Matrix
- Empty or overlong query -> schema rejection before content fetch.
- Missing `page` -> defaults to `1`; non-positive page -> schema rejection before content fetch.
- Unknown message type -> `{ ok: false, error: "Invalid sidepanel message" }`.
- `topicId !== topic.id` -> `{ ok: false, error: "Topic payload id mismatch" }`.
- Search fetch non-2xx -> structured `{ ok: false, error }` response.
- `chrome.tabs.sendMessage` lastError -> sidepanel falls back to native topic URL where applicable.

### 5. Good/Base/Bad Cases
- Good: Sidepanel submits a query, content script returns raw Discourse search JSON, sidepanel hydrates optional categories and normalizes through `normalizeSearchTopics()`, then the bottom sentinel loads page `2`, `3`, etc.
- Base: Search works without category metadata; topic cards render as uncategorized.
- Base: Search has results but no next page; the footer displays `已经到底了哦~`.
- Bad: Sidepanel sends `"LDCV_SEARCH_TOPICS"` or `"card" as any`; these bypass shared contracts and break validation/Reader animation assumptions.

### 6. Tests Required
- Shared messaging test accepts valid `ldcv.searchTopics` / `ldcv.openTopic` and rejects invalid queries.
- Content bridge test covers search success, invalid message, topic id mismatch, and open success.
- Sidepanel helper test covers submit-button type and structured handling of content-script messaging failures.
- Sidepanel helper test covers search pagination page forwarding, more-results detection, and topic dedupe during append.
- API service test asserts category metadata hydration does not request `/site.json` when metadata already exists.

### 7. Wrong vs Correct
#### Wrong
```typescript
chrome.tabs.sendMessage(tabId, { type: "LDCV_OPEN_TOPIC", topicId, topic });
void readerRuntime.open(topicId, { force: true, modalOrigin: "card" as any });
```

#### Correct
```typescript
chrome.tabs.sendMessage(
  tabId,
  SidePanelContentMessage.parse({ type: "ldcv.openTopic", topicId: topic.id, topic }),
);
await readerRuntime.open(topic.id, { force: true, modalOrigin: null });
```

```typescript
chrome.tabs.sendMessage(
  tabId,
  SidePanelContentMessage.parse({ type: "ldcv.searchTopics", query, page: nextPage }),
);
```

## Anti-Patterns
- **❌ Direct DOM Mutation of Host Elements**: Minimize altering the original Discourse DOM. Prefer hiding it via CSS or absolutely positioning the `ldcv-shell` over it.
- **❌ Trusting Host State**: Discourse SPA routing can be unpredictable. Rely on MutationObservers (`rootConnectionObserver`) to detect when the extension's root gets detached by Discourse's router.

## Convention: `mount.ts` composes runtime slices, it does not own every state machine

**What**: Keep `src/content/mount.ts` as the top-level content runtime orchestrator, but move cohesive stateful flows into dedicated runtime modules under `src/content/`.

**Current slices**:
- `topicListRuntime.ts`: topic list refresh, load-more, polling, pending-notice state, progressive reveal
- `nativeActionRuntime.ts`: native reply route guard/restore, feedback timers, cooldown helpers
- `readerRuntime.ts`: reader open/refresh/load-more, image viewer state, user preview state, reader abort lifecycle

**Why**: The content script still needs one place to wire route changes, rendering, storage sync, and page bridge integration together. But long async flows become harder to reason about when `mount.ts` owns every flag, timer, and abort controller directly.

**Dependency rule**:
- Runtime modules may depend on DOM-aware callbacks injected from `mount.ts`.
- Runtime modules should not reach back into unrelated global state by importing `mount.ts`.
- Cross-slice concerns such as viewed-topic persistence, root lifecycle, and native bridge dispatch stay in `mount.ts` unless a new slice has a clearly bounded responsibility.

**Example**:
```typescript
const readerRuntime = new ReaderRuntime({
  getSettings: () => settings,
  getReaderState: () => readerState,
  setReaderState: (updater) => {
    readerState = updater(readerState);
  },
  renderCurrent: (request) => renderCurrent(request),
  getTopicById: (topicId) => topicListRuntime.getTopicById(topicId),
});
```

**Related**: `src/content/mount.ts`, `src/content/topicListRuntime.ts`, `src/content/nativeActionRuntime.ts`, `src/content/readerRuntime.ts`

## Convention: New-topic apply flow emits navigation intent, it does not pick DOM targets in `mount.ts`

**What**: The new-topic apply action should produce a small feature-owned result object that includes merged data, visual-state updates, and an explicit navigation request. The current product contract for the update button is: apply pending new topics, close transient preview UI as needed, then return the page to the absolute top.

**Why**: Letting `mount.ts` infer a card id and scroll target couples render timing, sticky-offset calculation, and pending-topic ordering to one imperative chain. Emitting a navigation intent keeps the feature state machine testable and lets `mount.ts` stay an orchestrator rather than the owner of new-topic sequencing.

**Example**:
```typescript
const applyResult = buildApplyPendingRefreshResult({
  currentData: this.currentData,
  latestData: this.pendingLatestData,
  pendingTopics: this.pendingTopics,
  layout: this.deps.getSettings().layout,
});

if (applyResult?.navigation) {
  this.deps.onScheduleNavigation(applyResult.navigation);
}
```

**Related**:
- `src/content/newTopicApplyFlow.ts`
- `src/content/topicListRuntime.ts`
- `src/content/mount.ts`
- `tests/content/newTopicApplyFlow.test.ts`
- `tests/content/topicListRuntime.test.ts`

## Scenario: Page-top apply navigation must suppress delayed reader anchor restore

### 1. Scope / Trigger
- Trigger: `applyPendingRefresh()` in reader/list layout emits a `page-top` navigation request while progressive topic reveal still has hidden batches queued.

### 2. Signatures
- `buildApplyPendingRefreshResult(...) -> { navigation: { kind: "page-top"; durationMs: number } | null, revealDelayMs: number }`
- `startProgressiveTopicRendering(data, reset, deferRevealMs, { preservePageAnchorOnReveal? })`
- `renderCurrent({ preservePageAnchor?: boolean })`

### 3. Contracts
- If the apply-refresh flow emits `navigation.kind === "page-top"`, the delayed reveal render that follows must use `preservePageAnchor: false`.
- Reader/list load-more and ordinary append reveals may still preserve page anchor when they are not part of the page-top apply contract.
- `mount.ts` owns executing the navigation request, but `topicListRuntime.ts` owns whether follow-up reveal renders are allowed to restore a prior anchor.

### 4. Validation & Error Matrix
- Reader/list + apply pending topics + hidden batches remain -> page scroll ends at absolute top and the delayed reveal must not restore the old anchor.
- Reader/list + append/load-more without page-top apply -> preserve anchor remains allowed.
- Grid/masonry + apply pending topics -> no reader-style page-anchor preservation path is required.

### 5. Good/Base/Bad Cases
- Good: User clicks update from mid-page, the list scrolls to `window.scrollY === 0`, and later reveal batches do not snap the page back downward.
- Base: Applying pending topics when all cards are already visible still returns to the top with no extra anchor-restore work.
- Bad: Delayed reveal reuses the generic `shouldPreserveAppendPageAnchor("reader")` path after a page-top apply, causing a visible jump back to the previous reading position.

### 6. Tests Required
- Runtime regression test: reader/list apply flow with delayed reveal asserts the reveal render uses `preservePageAnchor: false`.
- Apply-flow runtime test: emitted navigation request remains `{ kind: "page-top", durationMs: 760 }`.
- Scroll utility test: page-top animation still reaches `0`.
- Manual QA assertion point: in list view, trigger new-topic update from mid-page and confirm the page stays at the absolute top after the delayed reveal window passes.

### 7. Wrong vs Correct
#### Wrong
```typescript
this.deps.renderCurrent({
  loading: false,
  error: "",
  preservePageAnchor: shouldPreserveAppendPageAnchor(settings.layout),
});
```

#### Correct
```typescript
this.deps.renderCurrent({
  loading: false,
  error: "",
  preservePageAnchor: this.progressiveRevealPreservePageAnchor,
});
```

## Convention: Viewed-topic persistence is merge-first, not snapshot-first

**What**: `viewedTopicIds` updates must be merged into storage with a read-modify-write flow. Do not write an in-memory snapshot back to `chrome.storage.local`.

**Why**: A stale snapshot can overwrite ids added by another tab or by a later local read before the earlier write resolves. The safe pattern is `load current -> merge incoming ids -> persist merged set -> verify storage still contains those ids -> merge the verified storage result into memory`.

**Example**:
```typescript
const persisted = await mergeViewedTopicIdsStorage([topicId], VIEWED_TOPICS_STORAGE_KEY, MAX_VIEWED_TOPIC_IDS);
viewedTopicIds = mergeViewedTopicIds(persisted, pendingViewedTopicIds, MAX_VIEWED_TOPIC_IDS);
```

**Related**: `src/content/mount.ts` flushes via debounce, keeps an in-flight id set for local optimistic reads, and `chrome.storage.onChanged` merges storage with both in-flight and pending ids instead of replacing memory wholesale.

> **Warning**: `chrome.storage.onChanged` can fire for the originating tab too. Treat it as a sync signal, not as proof that the current tab should replace memory with storage wholesale.

## Scenario: Reader read confirmation vs Discourse timing sync

### 1. Scope / Trigger
- Trigger: Reader content loads successfully in `src/content/mount.ts`, but `POST /t/:topic_id/timings` may fail for guests, expired login state, or transient CSRF/network issues.

### 2. Signatures
- `syncLoadedReaderPosts(reader, signal?, selectedPostNumbers?) -> Promise<boolean>`
- `markTopicReadConfirmed(topicId) -> void`
- `syncTopicReadTimings(reader, { postNumbers?, signal? }) -> Promise<boolean>`

### 3. Contracts
- Local read confirmation:
  Opened Reader data is sufficient to mark the topic as locally viewed and persist `linuxdoCardViewViewedTopics`.
- Native Discourse sync:
  `/t/:topic_id/timings` is best-effort only. Its failure must not roll back, skip, or block local viewed-state confirmation.
- Guest behavior:
  Anonymous Linux.do pages can still use local viewed badges even when native Discourse read timing sync is unavailable.

### 4. Validation & Error Matrix
- Reader data loaded + timing sync `200` -> mark local viewed, update sync cache, keep native state aligned.
- Reader data loaded + timing sync `403`/`401`/network error -> mark local viewed, keep warning non-blocking, do not clear local state.
- Reader fetch aborted before data is ready -> do not mark viewed from that aborted fetch.

### 5. Good/Base/Bad Cases
- Good: Guest opens a topic on `/latest`; card immediately becomes `is-viewed` and persists in `chrome.storage.local` even though `/timings` warns.
- Base: Logged-in user opens a topic; local viewed badge appears immediately and native timing sync succeeds afterward.
- Bad: Local `markTopicReadConfirmed` is placed only inside the success branch of `syncTopicReadTimings`, causing guest or expired-login sessions to never show viewed state.

### 6. Tests Required
- Unit/integration assertions for storage merge helpers: concurrent writes converge instead of losing ids.
- UI assertions for card patching: stale `is-viewed` / `is-just-read` classes are removed and unchanged inputs short-circuit.
- Manual QA assertion point:
  On `https://linux.do/latest` as guest, opening a Reader card must write `linuxdoCardViewViewedTopics` and display viewed styling even if the console still logs timing-sync failure.

### 7. Wrong vs Correct
#### Wrong
```typescript
const ok = await syncTopicReadTimings(reader, { postNumbers, signal });
if (!ok) {
  return false;
}
markTopicReadConfirmed(reader.id);
```

#### Correct
```typescript
if (!viewedTopicIds.has(reader.id)) {
  markTopicReadConfirmed(reader.id);
}

const ok = await syncTopicReadTimings(reader, { postNumbers, signal });
```
