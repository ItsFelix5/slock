import Quill from "quill";
import { createSignal } from "solid-js";

export interface LinkEditState {
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

export function createLinkEditController(getQuill: () => Quill | undefined) {
  const [state, setState] = createSignal<LinkEditState | undefined>(undefined);

  const close = () => setState(undefined);

  const openFromNode = (node: HTMLElement) => {
    const quill = getQuill();
    const link = quill && readLink(quill, node);
    if (!link) return;
    setState({ anchorEl: node, ...link, text: node.textContent ?? "" });
  };

  const handleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a");
    if (!link) return;
    event.preventDefault();
    openFromNode(link);
  };

  const handleDoubleClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a");
    const href = link?.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const revalidate = () => {
    const quill = getQuill();
    const current = state();
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
    const attrs = quill.getFormat(current.index, current.length);
    if (cleanUrl) attrs.link = cleanUrl;
    else attrs.link = undefined;
    quill.deleteText(current.index, current.length, "api");
    quill.insertText(current.index, cleanText, attrs, "api");
  };

  return { close, handleClick, handleDoubleClick, revalidate, state, update };
}
