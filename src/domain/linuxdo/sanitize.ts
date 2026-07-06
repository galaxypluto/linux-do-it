const ALLOWED_ATTRS = new Set([
  'href',
  'src',
  'alt',
  'title',
  'class',
  'width',
  'height',
  'colspan',
  'rowspan',
  'datetime',
  'open',
  'role',
  'type',
]);
const URI_ATTRS = new Set(['href', 'src']);
const DEFAULT_ORIGIN = 'https://linux.do';

export interface SanitizeCookedHtmlOptions {
  postId?: number;
  polls?: unknown[];
}

interface ReaderPollData {
  name?: unknown;
  title?: unknown;
  status?: unknown;
  options?: ReaderPollOptionData[];
  voters?: unknown;
}

interface ReaderPollOptionData {
  id?: unknown;
  html?: unknown;
  votes?: unknown;
}

interface ReaderPollOptionSummary {
  id: string;
  label: string;
  votes: number | null;
  percent: string;
}

export function sanitizeCookedHtml(cooked: unknown, options: SanitizeCookedHtmlOptions = {}): string {
  const doc = new DOMParser().parseFromString(textValue(cooked), 'text/html');

  doc.querySelectorAll('script, style, iframe, object, embed, svg, math').forEach((node) => {
    node.remove();
  });

  normalizeReaderHtml(doc, options);

  doc.querySelectorAll('form, input, select, textarea').forEach((node) => {
    node.remove();
  });
  doc.querySelectorAll('button:not([data-reader-poll-vote], [data-reader-copy-code])').forEach((node) => {
    node.remove();
  });

  doc.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
    for (const attr of Array.from(element.attributes)) {
      const name = attr.name.toLowerCase();
      if (
        name === 'style' &&
        element.hasAttribute('data-reader-poll-option-bar') &&
        /^width:\s*(?:100|[1-9]?\d)%\s*;?$/i.test(attr.value.trim())
      ) {
        continue;
      }
      if (
        name.startsWith('on') ||
        (!ALLOWED_ATTRS.has(name) && !name.startsWith('aria-') && !name.startsWith('data-reader-'))
      ) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (URI_ATTRS.has(name) && !isSafeUrl(attr.value)) {
        element.removeAttribute(attr.name);
      }
    }

    if (element.tagName.toLowerCase() === 'a') {
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
    }

    if (element.tagName.toLowerCase() === 'img') {
      element.setAttribute('loading', 'lazy');
      element.setAttribute('decoding', 'async');
    }
  });

  return doc.body.innerHTML.trim();
}

function normalizeReaderHtml(doc: Document, options: SanitizeCookedHtmlOptions): void {
  normalizeDetails(doc);
  normalizePolls(doc, options);
  normalizeQuotes(doc);
  normalizeOneboxes(doc);
  normalizeImageAttachments(doc);
  normalizeCodeBlocks(doc);
}

function normalizeDetails(doc: Document): void {
  doc.body.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => {
    details.className = appendClass(details.className, 'ldcv-reader-details');
    const summary =
      Array.from(details.children).find((child): child is HTMLElement => child.tagName.toLowerCase() === 'summary') ??
      doc.createElement('summary');

    if (!summary.textContent?.trim()) {
      summary.textContent = '展开内容';
    }
    summary.className = appendClass(summary.className, 'ldcv-reader-details__summary');

    const body = doc.createElement('div');
    body.className = 'ldcv-reader-details__body';
    Array.from(details.childNodes).forEach((child) => {
      if (child === summary) {
        return;
      }
      body.appendChild(child);
    });

    details.replaceChildren(summary, body);
  });
}

function normalizePolls(doc: Document, options: SanitizeCookedHtmlOptions): void {
  doc.body.querySelectorAll<HTMLElement>('.poll, [data-poll-name]').forEach((poll) => {
    if (poll.classList.contains('ldcv-reader-poll')) {
      return;
    }

    const pollName = textValue(poll.dataset.pollName).trim() || 'poll';
    const pollData = pollDataForName(options.polls, pollName);
    const optionSummaries = pollData ? pollDataOptionSummaries(pollData) : pollOptionSummaries(poll);
    const title =
      textValue(poll.querySelector('.poll-title, .poll-name, [data-poll-title]')?.textContent).trim() ||
      cleanPollHtml(pollData?.title) ||
      '投票';
    const meta = textValue(
      poll.querySelector('.poll-info, .poll-status, .poll-results, .poll-voters, .poll-total, .info')?.textContent,
    )
      .replace(/\s+/g, ' ')
      .trim();

    const voters = numeric(pollData?.voters);
    const totalVotes = optionSummaries.reduce((sum, option) => sum + (option.votes ?? 0), 0);
    const voterText = formatVoterCount(voters || numeric(meta.match(/\d+/)?.[0]));
    const postId = Number.isFinite(options.postId) && (options.postId ?? 0) > 0 ? String(options.postId) : '';
    const section = doc.createElement('section');
    section.className = 'ldcv-reader-poll';
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', title);
    section.setAttribute('data-reader-poll-name', pollName);
    section.setAttribute('data-reader-poll-voters', String(voters));
    if (postId) {
      section.setAttribute('data-reader-poll-post-id', postId);
    }

    const head = doc.createElement('div');
    head.className = 'ldcv-reader-poll__head';

    const titleNode = doc.createElement('div');
    titleNode.className = 'ldcv-reader-poll__title';
    titleNode.textContent = title;
    head.appendChild(titleNode);

    const note = doc.createElement('div');
    note.className = 'ldcv-reader-poll__note';
    note.textContent = postId ? '点击选项即可投票，成功后会同步到原贴。' : '投票内容仅供阅读器预览，请到原贴投票。';
    head.appendChild(note);

    const votersNode = doc.createElement('div');
    votersNode.className = 'ldcv-reader-poll__voters';
    votersNode.setAttribute('data-reader-poll-voters-label', 'true');
    votersNode.textContent = voterText;
    head.appendChild(votersNode);

    section.appendChild(head);

    const list = doc.createElement('div');
    list.className = 'ldcv-reader-poll__options';
    if (optionSummaries.length) {
      optionSummaries.forEach((option) => {
        const optionNode = doc.createElement('div');
        optionNode.className = 'ldcv-reader-poll__option';
        optionNode.setAttribute('data-reader-poll-option-id', option.id);
        if (option.votes !== null) {
          optionNode.setAttribute('data-reader-poll-option-votes', String(option.votes));
        }

        const row = doc.createElement('div');
        row.className = 'ldcv-reader-poll__option-row';

        const optionControl = postId && option.id ? doc.createElement('button') : doc.createElement('span');
        optionControl.className = postId && option.id ? 'ldcv-reader-poll__option-button' : 'ldcv-reader-poll__option-label';
        optionControl.textContent = option.label;
        if (optionControl.tagName.toLowerCase() === 'button') {
          optionControl.setAttribute('type', 'button');
          optionControl.setAttribute('data-reader-poll-vote', 'true');
          optionControl.setAttribute('data-reader-poll-post-id', postId);
          optionControl.setAttribute('data-reader-poll-name', pollName);
          optionControl.setAttribute('data-reader-poll-option-id', option.id);
        }
        row.appendChild(optionControl);

        const resultText = pollOptionResultText(option, totalVotes);
        if (resultText) {
          const result = doc.createElement('span');
          result.className = 'ldcv-reader-poll__option-result';
          result.setAttribute('data-reader-poll-option-result', 'true');
          result.textContent = resultText;
          row.appendChild(result);
        }

        optionNode.appendChild(row);
        if (option.votes !== null || option.percent) {
          const bar = doc.createElement('div');
          bar.className = 'ldcv-reader-poll__bar';
          bar.setAttribute('aria-hidden', 'true');
          const fill = doc.createElement('span');
          fill.setAttribute('data-reader-poll-option-bar', 'true');
          fill.style.width = pollOptionPercent(option, totalVotes);
          bar.appendChild(fill);
          optionNode.appendChild(bar);
        }
        list.appendChild(optionNode);
      });
    } else {
      const empty = doc.createElement('div');
      empty.className = 'ldcv-reader-poll__meta';
      empty.textContent = '此投票暂无可预览选项。';
      list.appendChild(empty);
    }

    section.appendChild(list);
    poll.replaceWith(section);
  });
}

function pollDataForName(polls: unknown[] | undefined, pollName: string): ReaderPollData | null {
  if (!Array.isArray(polls) || !polls.length) {
    return null;
  }

  const candidates = polls.filter(isRecord) as ReaderPollData[];
  return candidates.find((poll) => textValue(poll.name).trim() === pollName) ?? candidates[0] ?? null;
}

function pollDataOptionSummaries(poll: ReaderPollData): ReaderPollOptionSummary[] {
  if (!Array.isArray(poll.options)) {
    return [];
  }

  return poll.options
    .map((option): ReaderPollOptionSummary | null => {
      const id = textValue(option.id).trim();
      const label = cleanPollHtml(option.html) || id;
      if (!id || !label) {
        return null;
      }
      return {
        id,
        label,
        votes: numeric(option.votes),
        percent: '',
      };
    })
    .filter((option): option is ReaderPollOptionSummary => Boolean(option));
}

function pollOptionSummaries(poll: HTMLElement): ReaderPollOptionSummary[] {
  const candidates = Array.from(
    poll.querySelectorAll<HTMLElement>('li, label, .poll-option, [data-poll-option-id], [data-poll-option-name]'),
  );
  const seen = new Set<string>();
  const options: ReaderPollOptionSummary[] = [];

  candidates.forEach((candidate) => {
    if (candidate.closest('.poll-info, .poll-status, .poll-results, .poll-voters, .poll-total')) {
      return;
    }

    const clone = candidate.cloneNode(true);
    if (!(clone instanceof HTMLElement)) {
      return;
    }
    clone.querySelectorAll('input, button, svg').forEach((node) => node.remove());

    const rawText = textValue(clone.textContent).replace(/\s+/g, ' ').trim();
    if (!rawText) {
      return;
    }

    const percent = rawText.match(/\b\d+(?:\.\d+)?\s*%/)?.[0].replace(/\s+/g, '') ?? '';
    const label = rawText
      .replace(/\b\d+(?:\.\d+)?\s*%/g, '')
      .replace(/\b\d+\s*(?:票|votes?)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const key = label || rawText;
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    options.push({ id: textValue(candidate.dataset.pollOptionId).trim(), label: key, votes: null, percent });
  });

  return options;
}

function pollOptionResultText(option: ReaderPollOptionSummary, totalVotes: number): string {
  const percent = pollOptionPercent(option, totalVotes);
  if (option.votes !== null) {
    return `${option.votes} 票 · ${percent}`;
  }
  return option.percent;
}

function pollOptionPercent(option: ReaderPollOptionSummary, totalVotes: number): string {
  if (option.votes !== null) {
    if (totalVotes <= 0) {
      return '0%';
    }
    return `${Math.round((option.votes / totalVotes) * 100)}%`;
  }
  return option.percent || '0%';
}

function formatVoterCount(voters: number): string {
  return `${Math.max(0, voters)} 投票人`;
}

function cleanPollHtml(value: unknown): string {
  return textValue(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuotes(doc: Document): void {
  doc.body.querySelectorAll<HTMLElement>('aside.quote').forEach((quote) => {
    const titleLink = quote.querySelector<HTMLAnchorElement>('.title a');
    
    let username = quote.dataset.username || '';
    if (!username) {
      if (titleLink) {
        username = textValue(titleLink.textContent).replace(/^@/, '');
      } else {
        const titleDiv = quote.querySelector('.title');
        if (titleDiv && titleDiv.textContent) {
          username = textValue(titleDiv.textContent).replace(/^@/, '').replace(/:$/, '').trim();
        }
      }
    }

    const postNumber = quote.dataset.post || '';
    const topicId = quote.dataset.topic || '';
    
    let href = titleLink?.getAttribute('href') || '';
    if (!href && topicId) {
      href = `https://linux.do/t/-/${topicId}${postNumber ? `/${postNumber}` : ''}`;
    }

    const blockquote = quote.querySelector('blockquote');
    const body = doc.createElement('div');
    body.className = 'ldcv-reader-quote__body';

    if (blockquote) {
      while (blockquote.firstChild) {
        body.appendChild(blockquote.firstChild);
      }
    } else {
      Array.from(quote.childNodes).forEach((child) => {
        if (child instanceof HTMLElement && child.classList.contains('title')) {
          return;
        }
        body.appendChild(child.cloneNode(true));
      });
    }

    const title = doc.createElement('div');
    title.className = 'ldcv-reader-quote__title';
    const name = username ? `@${username}` : '引用内容';
    const titleText = postNumber ? `引用 ${name} #${postNumber}` : `引用 ${name}`;

    if (href) {
      const link = doc.createElement('a');
      link.href = href;
      link.textContent = titleText;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      title.appendChild(link);
    } else {
      title.textContent = titleText;
    }

    quote.className = appendClass(quote.className, 'ldcv-reader-quote');
    quote.replaceChildren(title, body);
  });
}

function normalizeOneboxes(doc: Document): void {
  doc.body.querySelectorAll<HTMLElement>('aside.onebox, div.onebox').forEach((onebox) => {
    const sourceLink = onebox.querySelector<HTMLAnchorElement>(
      'header.source a[href], .source a[href], header a[href], a[href]',
    );
    const titleLink = onebox.querySelector<HTMLAnchorElement>(
      'article h3 a[href], article h4 a[href], .onebox-body h3 a[href], .onebox-body h4 a[href], h3 a[href], h4 a[href]',
    );
    const description = onebox.querySelector<HTMLElement>('article p, .onebox-body p, .onebox-body .excerpt, p');
    const icon = Array.from(onebox.querySelectorAll<HTMLImageElement>('img')).find(isLikelyOneboxIcon);
    const fallbackUrl = onebox.getAttribute('data-onebox-src') || '';
    const href = titleLink?.getAttribute('href') || sourceLink?.getAttribute('href') || fallbackUrl;
    const sourceText = textValue(sourceLink?.textContent).trim() || domainFromUrl(href) || '链接引用';
    const titleText =
      textValue(titleLink?.textContent).trim() || textValue(onebox.querySelector('h3, h4')?.textContent).trim() || sourceText;

    const card = doc.createElement('div');
    card.className = 'ldcv-reader-onebox__inner';

    const source = doc.createElement('div');
    source.className = 'ldcv-reader-onebox__source';
    if (icon) {
      const iconClone = doc.createElement('img');
      iconClone.className = 'ldcv-reader-onebox__icon ldcv-reader-emoji';
      iconClone.setAttribute('src', icon.getAttribute('src') || '');
      iconClone.setAttribute('alt', icon.getAttribute('alt') || '');
      source.appendChild(iconClone);
    }

    const sourceNode = createTextOrLink(doc, href, sourceText, 'ldcv-reader-onebox__source-link');
    source.appendChild(sourceNode);
    card.appendChild(source);

    if (titleText && titleText !== sourceText) {
      card.appendChild(createTextOrLink(doc, href, titleText, 'ldcv-reader-onebox__title'));
    }

    if (description) {
      const descriptionNode = doc.createElement('div');
      descriptionNode.className = 'ldcv-reader-onebox__description';
      appendMeaningfulInlineContent(descriptionNode, description);
      if (descriptionNode.textContent?.trim()) {
        card.appendChild(descriptionNode);
      }
    }

    onebox.className = appendClass(onebox.className, 'ldcv-reader-onebox');
    onebox.replaceChildren(card);
  });
}

function createTextOrLink(doc: Document, href: string, text: string, className: string): HTMLElement {
  const element = href && isSafeUrl(href) ? doc.createElement('a') : doc.createElement('span');
  element.className = className;
  element.textContent = text;
  if (element instanceof HTMLAnchorElement) {
    element.setAttribute('href', href);
  }
  return element;
}

function appendMeaningfulInlineContent(target: HTMLElement, source: HTMLElement): void {
  Array.from(source.childNodes).forEach((child) => {
    if (child instanceof HTMLImageElement && isLikelyOneboxIcon(child)) {
      return;
    }
    target.appendChild(child.cloneNode(true));
  });
}

function normalizeCodeBlocks(doc: Document): void {
  doc.body.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) {
      return;
    }

    const wrapper = doc.createElement('div');
    wrapper.className = 'ldcv-reader-code-block';

    const header = doc.createElement('div');
    header.className = 'ldcv-reader-code-header';
    
    const langMatch = code.className.match(/\b(?:lang|language)-([\w-]+)\b/);
    const langLabel = doc.createElement('span');
    langLabel.className = 'ldcv-reader-code-lang';
    langLabel.textContent = langMatch ? langMatch[1] : 'CODE';
    header.appendChild(langLabel);

    const copyBtn = doc.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'ldcv-reader-copy-button';
    copyBtn.setAttribute('data-reader-copy-code', 'true');
    copyBtn.setAttribute('aria-label', '复制代码');
    copyBtn.textContent = '复制';
    header.appendChild(copyBtn);

    wrapper.appendChild(header);

    const preClone = pre.cloneNode(true) as HTMLElement;
    wrapper.appendChild(preClone);

    pre.replaceWith(wrapper);
  });
}

function normalizeImageAttachments(doc: Document): void {
  doc.body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const image = anchor.querySelector<HTMLImageElement>('img');
    if (!image) {
      return;
    }

    if (isEmojiImage(image)) {
      return;
    }

    const imageUrl = anchor.getAttribute('href') || image.getAttribute('src') || '';
    if (!imageUrl) {
      return;
    }

    anchor.className = appendClass(anchor.className, 'ldcv-reader-image-link');
    anchor.setAttribute('data-reader-image', absoluteSafeUrl(imageUrl));
    image.className = appendClass(image.className, 'ldcv-reader-image');
    image.setAttribute('data-reader-image-src', absoluteSafeUrl(imageUrl));
    image.setAttribute('data-reader-image-alt', image.getAttribute('alt') || '');

    stripImageAttachmentMetadata(anchor);
    stripLightboxWrapperMetadata(anchor);
    removeDuplicateAttachmentLink(anchor, imageUrl);
  });

  doc.body.querySelectorAll<HTMLImageElement>('img:not(.ldcv-reader-image)').forEach((image) => {
    if (isEmojiImage(image)) {
      image.className = appendClass(image.className, 'ldcv-reader-emoji');
      return;
    }

    const src = image.getAttribute('src') || '';
    if (!src) {
      return;
    }
    image.className = appendClass(image.className, 'ldcv-reader-image');
    image.setAttribute('data-reader-image-src', absoluteSafeUrl(src));
    image.setAttribute('data-reader-image-alt', image.getAttribute('alt') || '');
  });

  removeLooseAttachmentLabels(doc);
}

function removeDuplicateAttachmentLink(anchor: HTMLAnchorElement, imageUrl: string): void {
  if (removeInlineAttachmentLink(anchor, imageUrl)) {
    return;
  }

  const block = imageOnlyBlock(anchor);
  const candidates = [nextElement(anchor), block && block !== anchor ? nextElement(block) : null];

  for (const candidate of candidates) {
    if (!candidate || !isDuplicateAttachment(candidate, imageUrl)) {
      continue;
    }
    candidate.remove();
    break;
  }
}

function stripImageAttachmentMetadata(anchor: HTMLAnchorElement): void {
  const preserved = new Set<Node>();
  anchor.querySelectorAll('img, picture, source, video').forEach((media) => {
    let current: Node | null = media;
    while (current && current !== anchor) {
      preserved.add(current);
      current = current.parentNode;
    }
  });

  removeUnpreservedChildren(anchor, preserved);

  const title = anchor.getAttribute('title') || '';
  if (looksLikeAttachmentLabel(title)) {
    anchor.removeAttribute('title');
  }
}

function stripLightboxWrapperMetadata(anchor: HTMLAnchorElement): void {
  const wrapper = anchor.closest<HTMLElement>('.lightbox-wrapper');
  if (!wrapper) {
    return;
  }

  const preserved = new Set<Node>();
  let current: Node | null = anchor;
  while (current && current !== wrapper) {
    preserved.add(current);
    current = current.parentNode;
  }

  wrapper.querySelectorAll('img, picture, source, video').forEach((media) => {
    current = media;
    while (current && current !== wrapper) {
      preserved.add(current);
      current = current.parentNode;
    }
  });

  removeUnpreservedChildren(wrapper, preserved);
}

function isLikelyOneboxIcon(image: HTMLImageElement): boolean {
  const className = image.className || '';
  const src = image.getAttribute('src') || '';
  const width = numericAttribute(image.getAttribute('width'));
  const height = numericAttribute(image.getAttribute('height'));
  const inSourceHeader = Boolean(image.closest('header, .source'));

  return (
    inSourceHeader ||
    /\b(site-icon|favicon|onebox-avatar)\b/i.test(className) ||
    /(?:^|\/)(favicon|apple-touch-icon)(?:[./-]|$)/i.test(src) ||
    (width > 0 && height > 0 && width <= 64 && height <= 64)
  );
}

function isEmojiImage(image: HTMLImageElement): boolean {
  const className = image.className || '';
  const alt = image.getAttribute('alt') || '';
  const title = image.getAttribute('title') || '';
  const src = image.getAttribute('src') || '';
  const width = numericAttribute(image.getAttribute('width'));
  const height = numericAttribute(image.getAttribute('height'));

  return (
    /\b(emoji|emoticon|smiley|twemoji)\b/i.test(className) ||
    /^:[\w+-]+:$/i.test(alt.trim()) ||
    /^:[\w+-]+:$/i.test(title.trim()) ||
    /(?:^|\/)(emoji|emojis|twemoji|emoji-one|emoji_one)(?:\/|$)/i.test(src) ||
    (width > 0 && height > 0 && width <= 48 && height <= 48 && /^:[\w+-]+:$/i.test((alt || title).trim()))
  );
}

function domainFromUrl(value: string): string {
  if (!value) {
    return '';
  }

  try {
    return new URL(value, DEFAULT_ORIGIN).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function numericAttribute(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function removeUnpreservedChildren(parent: Node, preserved: Set<Node>): void {
  Array.from(parent.childNodes).forEach((child) => {
    if (!preserved.has(child)) {
      child.remove();
      return;
    }
    removeUnpreservedChildren(child, preserved);
  });
}

function removeInlineAttachmentLink(anchor: HTMLAnchorElement, imageUrl: string): boolean {
  const parent = anchor.parentElement;
  if (!parent) {
    return false;
  }

  const attachmentLinks = Array.from(parent.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
    (link) => link !== anchor && !link.querySelector('img'),
  );
  for (const link of attachmentLinks) {
    if (!isDuplicateAttachmentAnchor(link, imageUrl)) {
      continue;
    }
    link.remove();
    return true;
  }

  return false;
}

function removeLooseAttachmentLabels(doc: Document): void {
  const hasInlineImage = Boolean(doc.body.querySelector('.ldcv-reader-image, img'));
  doc.body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    if (anchor.querySelector('img')) {
      return;
    }

    const href = anchor.getAttribute('href') || '';
    const isUploadAttachment = isLikelyImageAttachmentUrl(href);
    if (!looksLikeAttachmentLabel(anchor.textContent || '') && !(hasInlineImage && isUploadAttachment)) {
      return;
    }

    attachmentOnlyBlock(anchor).remove();
  });
}

function imageOnlyBlock(anchor: HTMLAnchorElement): HTMLElement {
  const parent = anchor.parentElement;
  if (!parent || !['P', 'DIV'].includes(parent.tagName)) {
    return anchor;
  }

  const text = parent.textContent?.trim() || '';
  const images = parent.querySelectorAll('img').length;
  const links = parent.querySelectorAll('a').length;
  return images >= 1 && links === 1 && (!text || text === anchor.textContent?.trim()) ? parent : anchor;
}

function attachmentOnlyBlock(anchor: HTMLAnchorElement): HTMLElement {
  const parent = anchor.parentElement;
  if (!parent || !['P', 'DIV'].includes(parent.tagName)) {
    return anchor;
  }

  const text = parent.textContent?.replace(/\u00a0/g, ' ').trim() || '';
  const onlyLink = parent.querySelectorAll('a').length === 1;
  return onlyLink && looksLikeAttachmentLabel(text) ? parent : anchor;
}

function isDuplicateAttachment(element: Element, imageUrl: string): boolean {
  const anchor =
    element instanceof HTMLAnchorElement
      ? element
      : element.matches('p, div') && element.children.length === 1 && element.firstElementChild instanceof HTMLAnchorElement
        ? element.firstElementChild
        : null;
  if (!anchor) {
    return false;
  }

  return isDuplicateAttachmentAnchor(anchor, imageUrl);
}

function isDuplicateAttachmentAnchor(anchor: HTMLAnchorElement, imageUrl: string): boolean {
  if (anchor.querySelector('img')) {
    return false;
  }

  if (!looksLikeAttachmentLabel(anchor.textContent || '')) {
    return false;
  }

  const href = anchor.getAttribute('href') || '';
  return sameUrl(href, imageUrl) || isLikelyImageAttachmentUrl(href);
}

function looksLikeAttachmentLabel(value: string): boolean {
  const text = value.replace(/\u00a0/g, ' ').trim();
  if (!text) {
    return false;
  }

  return (
    /^(image|screenshot|截图)[\w\s._-]*[x×]\s*\d+.*\b\d+(\.\d+)?\s*(kb|mb|gb)\b/i.test(text) ||
    /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(text) ||
    (/\b\d+(\.\d+)?\s*(kb|mb|gb)\b/i.test(text) && /(image|screenshot|截图|\d+\s*[x×]\s*\d+)/i.test(text))
  );
}

function isLikelyImageAttachmentUrl(value: string): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value, DEFAULT_ORIGIN);
    const pathname = url.pathname.toLowerCase();
    return (
      pathname.includes('/uploads/') ||
      pathname.includes('/optimized/') ||
      /\.(png|jpe?g|gif|webp|avif)$/i.test(pathname)
    );
  } catch {
    return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(value);
  }
}

function nextElement(element: Element): Element | null {
  let next = element.nextElementSibling;
  while (next && !next.textContent?.trim() && next.children.length === 0) {
    next = next.nextElementSibling;
  }
  return next;
}

function sameUrl(left: string, right: string): boolean {
  return normalizeUrl(left) === normalizeUrl(right);
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value, DEFAULT_ORIGIN);
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

function absoluteSafeUrl(value: string): string {
  if (!isSafeUrl(value)) {
    return '';
  }

  return normalizeUrl(value);
}

function appendClass(current: string, nextClass: string): string {
  return Array.from(new Set(`${current} ${nextClass}`.trim().split(/\s+/).filter(Boolean))).join(' ');
}

function isSafeUrl(value: string): boolean {
  if (!value) {
    return false;
  }

  if (value.startsWith('/') || value.startsWith('#')) {
    return true;
  }

  try {
    const url = new URL(value, DEFAULT_ORIGIN);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
