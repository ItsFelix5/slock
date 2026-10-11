const SLACK_HOST = /(^|\.)slack\.com$/i;
const DOCS_PATH = /^\/docs\/[A-Z0-9]+\/([A-Z0-9]+)\/?$/i;

function parseCanvasLink(href: string): string | undefined {
  const url = URL.parse(href);
  if (url?.protocol !== "https:" || !SLACK_HOST.test(url.hostname)) return;
  return DOCS_PATH.exec(url.pathname)?.[1];
}

export function openCanvasLinksOnClick(open: (fileId: string) => void): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    const fileId = anchor instanceof HTMLAnchorElement ? parseCanvasLink(anchor.href) : undefined;
    if (!fileId) return;
    event.preventDefault();
    open(fileId);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
