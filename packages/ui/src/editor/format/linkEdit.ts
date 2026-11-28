import { createSignal, untrack } from "solid-js";
import Quill from "../quill";

interface LinkEditState {
  anchorEl: HTMLElement;
  index: number;
  length: number;
  text: string;
  url: string;
}

function readLink(
  quill: Quill,
  node: HTMLElement,
): { index: number; length: number; url: string } | undefined {
  if (!node.isConnected) return;
  const blot = Quill.find(node, true);
  if (!(blot && "length" in blot)) return;
  const index = quill.getIndex(blot);
  const length = blot.length();
  const format = quill.getFormat(index, length);
  return typeof format.link === "string" ? { index, length, url: format.link } : undefined;
}

// Links in nested editors also sit inside the outer one, which must leave them alone.
function ownLink(quill: Quill, target: EventTarget | Node | null) {
  const element =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const link = element?.closest("a");
  return link?.closest(".ql-editor") === quill.root && link.getAttribute("href") ? link : undefined;
}

function openTab(link: HTMLAnchorElement) {
  window.open(link.href, "_blank", "noopener,noreferrer");
}

export function caretLink(quill: Quill) {
  return ownLink(quill, window.getSelection()?.focusNode ?? null);
}

export function followLink(quill: Quill, link: HTMLAnchorElement) {
  if (quill.isEnabled()) openTab(link);
  else link.click();
}

export function createLinkEditController(getQuill: () => Quill | undefined) {
  const [state, setState] = createSignal<LinkEditState | undefined>(undefined);

  const close = () => setState(undefined);

  const openFromNode = (node: HTMLElement) => {
    const quill = getQuill();
    const link = quill && readLink(quill, node);
    if (!link) return;
    setState({ anchorEl: node, ...link, text: node.textContent ?? "" });
  };

  const clicked = (event: MouseEvent) => {
    const quill = getQuill();
    const link = quill && ownLink(quill, event.target);
    return link ? { link, quill } : undefined;
  };

  const handleClick = (event: MouseEvent) => {
    const found = clicked(event);
    if (!found) return;
    if (found.quill.isEnabled()) {
      event.preventDefault();
      openFromNode(found.link);
    } else if (found.link.isContentEditable && window.getSelection()?.isCollapsed) {
      // Browsers do not follow links inside editable content.
      openTab(found.link);
    }
  };

  const handleDoubleClick = (event: MouseEvent) => {
    const found = clicked(event);
    if (!found?.quill.isEnabled()) return;
    event.preventDefault();
    openTab(found.link);
  };

  const revalidate = () => {
    const quill = getQuill();
    const current = untrack(state);
    if (!(quill && current)) return;
    const link = readLink(quill, current.anchorEl);
    if (!link) {
      close();
      return;
    }
    if (link.index !== current.index || link.length !== current.length) {
      setState({ ...current, ...link });
    }
  };

  const update = (url: string, text: string) => {
    const quill = getQuill();
    const current = state();
    if (!(quill && current)) return;
    const cleanUrl = url.trim();
    const cleanText = text || cleanUrl;
    if (!cleanText) return;
    if (cleanUrl === current.url && cleanText === current.text) return;
    const link = readLink(quill, current.anchorEl);
    if (!link) return;
    const attrs = quill.getFormat(link.index, link.length);
    attrs.link = cleanUrl || undefined;
    if (cleanText === current.text) {
      quill.formatText(link.index, link.length, "link", cleanUrl, "api");
      return;
    }
    const Delta = Quill.import("delta");
    quill.updateContents(
      new Delta().retain(link.index).delete(link.length).insert(cleanText, attrs),
      "api",
    );
  };

  return { close, handleClick, handleDoubleClick, revalidate, state, update };
}
