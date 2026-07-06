import { afterEach, describe, expect, it } from "vitest";
import { listInsertionPoint, mainOutlet, rootInsertionTarget } from "../../src/content/pageDetector";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("page detector", () => {
  it("uses the concrete list area when a topic list route has rendered", () => {
    document.body.innerHTML = `
      <main id="main-outlet">
        <section id="list-area">
          <table class="topic-list"></table>
        </section>
      </main>
    `;

    expect(mainOutlet()?.id).toBe("main-outlet");
    expect(listInsertionPoint()?.id).toBe("list-area");
  });

  it("does not treat a stale topic outlet as a list insertion point during back navigation", () => {
    document.body.innerHTML = `
      <main id="main-outlet">
        <article class="topic-post">Topic detail still being torn down</article>
      </main>
    `;

    expect(listInsertionPoint()).toBeNull();
  });

  it("falls back to a contents node only when it contains list content", () => {
    document.body.innerHTML = `
      <main id="main-outlet">
        <section class="contents">
          <div class="topic-list-body"></div>
        </section>
      </main>
    `;

    expect(listInsertionPoint()?.classList.contains("contents")).toBe(true);
  });

  it("uses the list insertion parent for the card root", () => {
    document.body.innerHTML = `
      <main id="main-outlet">
        <div class="row">
          <section id="list-area">
            <table class="topic-list"></table>
          </section>
        </div>
      </main>
    `;

    const target = rootInsertionTarget();

    expect(target?.parent.className).toBe("row");
    expect((target?.before as HTMLElement | null)?.id).toBe("list-area");
    expect(target?.mode).toBe("list");
  });

  it("can preserve the card root in the outlet while a native reply route restores", () => {
    document.body.innerHTML = `
      <div id="main-outlet-wrapper">
        <main id="main-outlet">
          <article id="topic">Topic detail temporarily rendered by Discourse</article>
        </main>
      </div>
    `;

    expect(rootInsertionTarget()).toBeNull();

    const target = rootInsertionTarget({ preserveWithoutList: true });

    expect(target?.parent.id).toBe("main-outlet");
    expect((target?.before as HTMLElement | null)?.id).toBe("topic");
    expect(target?.mode).toBe("preserve");
  });

  it("does not treat topic-page related lists as the native reply restore mount point", () => {
    document.body.innerHTML = `
      <div id="main-outlet-wrapper">
        <main id="main-outlet">
          <article id="topic">Topic detail temporarily rendered by Discourse</article>
          <aside class="latest-topic-list">
            <a class="latest-topic-list-item">Related topic</a>
          </aside>
        </main>
      </div>
    `;

    const target = rootInsertionTarget({ preserveWithoutList: true });

    expect(target?.parent.id).toBe("main-outlet");
    expect((target?.before as HTMLElement | null)?.id).toBe("topic");
    expect(target?.mode).toBe("preserve");
  });
});
