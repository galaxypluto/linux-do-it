type RouteCallback = () => void;

let installed = false;
let observer: MutationObserver | null = null;

export function watchRouteChanges(callback: RouteCallback): void {
  if (!installed) {
    installed = true;
    patchHistory("pushState");
    patchHistory("replaceState");
  }

  window.addEventListener("popstate", callback);
  window.addEventListener("linuxdo-card-view:navigation", callback);
  startDomObserver(callback);
}

function patchHistory(method: "pushState" | "replaceState"): void {
  const original = history[method];
  history[method] = function patchedHistoryMethod(
    this: History,
    data: unknown,
    unused: string,
    url?: string | URL | null
  ) {
    const result = original.call(this, data, unused, url);
    window.dispatchEvent(new Event("linuxdo-card-view:navigation"));
    return result;
  };
}

function startDomObserver(callback: RouteCallback): void {
  if (observer) {
    return;
  }

  let lastPath = window.location.pathname;
  let pending: number | undefined;
  const schedule = (): void => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      callback();
    }, 160);
  };

  observer = new MutationObserver((mutations) => {
    const pathChanged = window.location.pathname !== lastPath;
    if (pathChanged) {
      lastPath = window.location.pathname;
      schedule();
      return;
    }

    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (isRelevantRouteNode(node)) {
          schedule();
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function isRelevantRouteNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    node.id === "main-outlet" ||
      node.id === "list-area" ||
      node.classList.contains("contents") ||
      node.classList.contains("topic-list") ||
      node.querySelector("#main-outlet, #list-area, .contents, .topic-list")
  );
}
