import { isFileId } from "@slock/slack";
import type { FileId } from "@slock/types";
import { onLinkClick } from "@slock/ui/linkClick";

const SLACK_HOST = /(^|\.)slack\.com$/i;
// Permalinks, plus the two address bar forms of the web client.
const DOCS_PATH =
  /^(?:\/client\/[A-Z0-9]+)?\/(?:docs\/[A-Z0-9]+|unified-files\/doc)\/([A-Z0-9]+)\/?$/i;

export function parseCanvasLink(href: string): FileId | undefined {
  const url = URL.parse(href);
  if (url?.protocol !== "https:" || !SLACK_HOST.test(url.hostname)) return;
  const id = DOCS_PATH.exec(url.pathname)?.[1];
  return id && isFileId(id) ? id : undefined;
}

export function openCanvasLinksOnClick(open: (fileId: FileId) => void): () => void {
  return onLinkClick((anchor) => {
    const fileId = parseCanvasLink(anchor.href);
    if (!fileId) return false;
    open(fileId);
    return true;
  });
}
