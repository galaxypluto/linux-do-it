# Styles And UI

`linux-do-it` uses a hybrid styling approach, combining a robust Vanilla CSS base (`base-list.css`) with modern React + Tailwind capabilities for specific components.

## Vanilla CSS Base (`src/styles/base-list.css`)

The core extension skeleton and layout rely on scoped CSS custom properties to avoid clashing with the host page (Discourse).

### Key Rules
- **Prefixes**: All base classes and CSS variables must start with `ldcv-` (e.g., `.ldcv-shell`, `--ldcv-private-message-gap`).
- **Color Theming**: Use the predefined `color-mix` variables for theming (e.g., `--surface`, `--surface-strong`, `--text`, `--accent`).
- **Isolation**: Use `isolation: isolate` and strict specificity to ensure Discourse CSS does not leak into the reader UI.

### Convention: Selected cards must not change text metrics

**What**: `.ldcv-card.is-selected` may use container-level emphasis such as border, background, glow, shadow, or Reader-only beam effects, but it must not change title font weight, text stroke, or any other property that changes the title's layout metrics.

**Why**: Masonry cards are watched by `ResizeObserver`; if selected-state styling changes title wrapping or measured height, `scheduleMasonry()` recalculates spans and nearby cards visibly jump.

**Good**:
```css
.ldcv-card.is-selected {
  box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 15%, transparent);
}
```

**Bad**:
```css
.ldcv-card.is-selected .ldcv-card__title {
  -webkit-text-stroke: 0.03em currentColor;
}
```

### Convention: Topic-card labels are compact by default

**What**: Topic cards and Reader topic headers should default to `2` visible tags. Additional tags collapse into a single `+N` chip with the full tag list in the tooltip.

**Why**: Card density is tighter and more stable in grid/masonry layouts, and the same contract avoids Vanilla/React divergence.

**Source/Test anchors**:
- `src/ui/cards.ts`
- `src/ui/react/components/TopicLabels.tsx`
- `tests/ui/cards.test.ts`

### Convention: Topic-card publish time keeps relative tiers with timezone-aware day boundaries

**What**: `formatPublishTime()` must keep the existing topic-card publish-time tiers: `今天发布`, `X天前发布`, then `YYYY-MM-DD 发布` for older topics. The day-boundary comparison must use an explicit timezone context instead of implicit `Date#getFullYear()` local buckets.

**Why**: Linux.do / Discourse renders topic timestamps against the viewer's page/browser timezone. If card publish-time labels bucket days in a different timezone, topics around midnight show the wrong relative day or absolute date.

**Source/Test anchors**:
- `src/ui/format.ts`
- `src/ui/cards.ts`
- `tests/ui/format.test.ts`

### Convention: Topic-card display text strips emoji shortcodes

**What**: Topic-card display text must remove `:emoji-slug:` shortcodes before rendering titles or excerpts. Reader body/comment HTML is out of scope; this rule is only for topic-card text surfaces.

**Why**: Linux.do list payloads can expose raw Discourse emoji shortcodes that read as noise in cards and can differ across grid, masonry, and Reader-list variants unless normalization is shared.

**Source/Test anchors**:
- `src/discourse/normalize.ts`
- `src/domain/linuxdo/normalize.ts`
- `tests/discourse/normalize.test.ts`
- `tests/unit/linuxdo-normalize.test.ts`

## React & Tailwind (`src/ui/react/`)

For complex interactive features, the extension leverages React and Tailwind CSS.

### Key Rules
- **Tailwind Config**: We use the new Tailwind v4 format (`@tailwindcss/vite`).
- **Component Placement**: React components belong in `src/ui/react/components/`.
- **Hybrid Integration**: When mounting React within the vanilla DOM, ensure the mount point handles cleanup properly and doesn't conflict with Vanilla JS state mutations.

### Convention: Fresh-comment blur animation is once per Reader session

**What**: `ldcv-blur-fade-in` should only apply to post numbers that appear for the first time in the current Reader session. Refreshes, sort changes, or rerenders of an already-seen post must keep the `is-fresh` badge semantics without replaying the blur animation.

**Why**: Replaying entrance animation on every rerender makes refresh feel glitchy and doubles the motion when the same comment remains in view.

**Source/Test anchors**:
- `src/ui/react/reader/ReaderContent.tsx`
- `src/ui/react/reader/CommentItem.tsx`
- `tests/ui/readerContent.test.ts`

### Convention: Topic-card `new` marker lifecycle is separate from card entering animation

**What**: Topic-card `new` state and topic-card entering animation must be represented as separate lifecycles. A card may keep its stable `new` badge across rerenders without re-entering. In reader/list layout, applying pending new topics should keep the `new` marker while suppressing card entrance animation replay.

**Why**: Reusing the same state for both semantics causes repeated fade/flash behavior when the background rerenders, especially after new-topic detection or apply-refresh flows. Stable marker state should describe "this topic is newly applied"; entering state should describe only a one-shot visual transition.

**Good**:
```typescript
return {
  newTopicIds,
  enteringTopicIds: layout === "reader" ? new Set() : new Set(newTopicIds),
};
```

**Bad**:
```typescript
return {
  newTopicIds,
  enteringTopicIds: new Set(newTopicIds),
};
```

**Source/Test anchors**:
- `src/content/newTopicApplyFlow.ts`
- `src/content/topicListRuntime.ts`
- `src/ui/render.ts`
- `tests/content/newTopicApplyFlow.test.ts`
- `tests/ui/render.test.ts`

## Anti-Patterns
- **❌ Hardcoding colors**: Never use raw hex codes like `#fff` or `#000` in the UI logic. Always reference the `var(--text)` or `var(--surface)` CSS variables to support Dark/Light mode seamlessly.
- **❌ Overriding host styles globally**: Do not write CSS that targets generic tags like `div` or `span` without scoping them under `.ldcv-` containers.
