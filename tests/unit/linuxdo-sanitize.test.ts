import { describe, expect, it } from 'vitest';
import { sanitizeCookedHtml } from '../../src/domain/linuxdo/sanitize';

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('sanitizeCookedHtml', () => {
  it('removes dangerous nodes and attributes while preserving safe reader data', () => {
    const html = sanitizeCookedHtml(`
      <p onclick="alert(1)" data-reader-source="kept" data-site-source="drop">
        hello
        <script>alert(1)</script>
        <iframe src="https://example.com"></iframe>
        <a href="javascript:alert(1)" onclick="alert(2)">unsafe link</a>
        <img src="https://linux.do/uploads/example.png" onerror="alert(3)" alt="example">
      </p>
    `);
    const doc = parseHtml(html);
    const paragraph = doc.querySelector('p');
    const anchor = doc.querySelector('a');
    const image = doc.querySelector('img');

    expect(doc.querySelector('script, iframe')).toBeNull();
    expect(paragraph?.getAttribute('onclick')).toBeNull();
    expect(paragraph?.getAttribute('data-site-source')).toBeNull();
    expect(paragraph?.getAttribute('data-reader-source')).toBe('kept');
    expect(anchor?.getAttribute('href')).toBeNull();
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(image?.getAttribute('onerror')).toBeNull();
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('decoding')).toBe('async');
  });

  it('normalizes Discourse quote blocks into reader quote cards', () => {
    const html = sanitizeCookedHtml(`
      <aside class="quote" data-username="alice" data-post="12">
        <div class="title"><a href="/u/alice">@alice</a></div>
        <blockquote><p>quoted body</p></blockquote>
      </aside>
    `);
    const doc = parseHtml(html);
    const quote = doc.querySelector('.ldcv-reader-quote');

    expect(quote).not.toBeNull();
    expect(quote?.querySelector('.ldcv-reader-quote__title')?.textContent).toBe('引用 @alice #12');
    expect(quote?.querySelector('.ldcv-reader-quote__body')?.textContent?.trim()).toBe('quoted body');
    expect(quote?.querySelector('.title')).toBeNull();
  });

  it('normalizes oneboxes into compact reader link cards', () => {
    const html = sanitizeCookedHtml(`
      <aside class="onebox" data-onebox-src="https://example.com/article">
        <header class="source">
          <img src="/favicon.png" width="16" height="16" alt="">
          <a href="https://example.com">example.com</a>
        </header>
        <article>
          <h3><a href="https://example.com/article">Example article</a></h3>
          <p>Onebox summary</p>
        </article>
      </aside>
    `);
    const doc = parseHtml(html);
    const onebox = doc.querySelector('.ldcv-reader-onebox');

    expect(onebox).not.toBeNull();
    expect(onebox?.querySelector('.ldcv-reader-onebox__source')?.textContent).toContain('example.com');
    expect(onebox?.querySelector('.ldcv-reader-onebox__title')?.textContent).toBe('Example article');
    expect(onebox?.querySelector('.ldcv-reader-onebox__description')?.textContent).toBe('Onebox summary');
    expect(onebox?.querySelector('img')?.classList.contains('ldcv-reader-emoji')).toBe(true);
  });

  it('marks reader images and removes duplicate attachment labels', () => {
    const html = sanitizeCookedHtml(`
      <p>
        <a href="/uploads/default/original/1X/photo.png">
          <img src="/uploads/default/optimized/1X/photo_690x388.png" alt="photo">
        </a>
      </p>
      <p><a href="/uploads/default/original/1X/photo.png">image690x388 12.3 KB</a></p>
    `);
    const doc = parseHtml(html);
    const imageLink = doc.querySelector('a.ldcv-reader-image-link');
    const image = doc.querySelector('img.ldcv-reader-image');

    expect(imageLink?.getAttribute('data-reader-image')).toContain('/uploads/default/original/1X/photo.png');
    expect(image?.getAttribute('data-reader-image-src')).toContain('/uploads/default/original/1X/photo.png');
    expect(doc.body.textContent).not.toContain('image690');
  });

  it('keeps emoji images out of the reader image viewer', () => {
    const html = sanitizeCookedHtml(`
      <p><img class="emoji" src="/images/emoji/twitter/heart.png" alt=":heart:" width="20" height="20"></p>
    `);
    const doc = parseHtml(html);
    const image = doc.querySelector('img');

    expect(image?.classList.contains('ldcv-reader-emoji')).toBe(true);
    expect(image?.classList.contains('ldcv-reader-image')).toBe(false);
    expect(image?.getAttribute('data-reader-image-src')).toBeNull();
  });

  it('normalizes collapsible details into reader details blocks', () => {
    const html = sanitizeCookedHtml(`
      <details>
        <summary>总结</summary>
        <p>此文本将被隐藏</p>
      </details>
    `);
    const doc = parseHtml(html);
    const details = doc.querySelector('details.ldcv-reader-details');

    expect(details).not.toBeNull();
    expect(details?.querySelector('.ldcv-reader-details__summary')?.textContent).toBe('总结');
    expect(details?.querySelector('.ldcv-reader-details__body')?.textContent).toContain('此文本将被隐藏');
  });

  it('normalizes Discourse polls into reader vote controls when post id is available', () => {
    const html = sanitizeCookedHtml(`
      <div class="poll" data-poll-name="favorite">
        <div class="poll-title">选择一个选项</div>
        <ul>
          <li data-poll-option-id="a"><label><input type="radio" name="poll">选项 A 60%</label></li>
          <li data-poll-option-id="b"><label><input type="radio" name="poll">选项 B 40%</label></li>
        </ul>
        <button>投票</button>
      </div>
    `, {
      postId: 123,
      polls: [
        {
          name: 'favorite',
          options: [
            { id: 'a', html: '选项 A', votes: 2 },
            { id: 'b', html: '选项 B', votes: 1 },
          ],
          voters: 3,
        },
      ],
    });
    const doc = parseHtml(html);
    const poll = doc.querySelector('.ldcv-reader-poll');
    const voteButton = doc.querySelector<HTMLButtonElement>('[data-reader-poll-vote]');

    expect(poll?.getAttribute('role')).toBe('group');
    expect(poll?.getAttribute('data-reader-poll-post-id')).toBe('123');
    expect(poll?.getAttribute('data-reader-poll-name')).toBe('favorite');
    expect(poll?.textContent).toContain('选择一个选项');
    expect(poll?.textContent).toContain('3 投票人');
    expect(poll?.textContent).toContain('选项 A');
    expect(poll?.textContent).toContain('2 票 · 67%');
    expect(poll?.textContent).toContain('1 票 · 33%');
    expect(voteButton?.dataset.readerPollPostId).toBe('123');
    expect(voteButton?.dataset.readerPollName).toBe('favorite');
    expect(voteButton?.dataset.readerPollOptionId).toBe('a');
    expect(doc.querySelector('[data-reader-poll-option-bar]')?.getAttribute('style')).toContain('width: 67%');
    expect(poll?.querySelector('input, form')).toBeNull();
  });
});
