import { encodeTextEntities } from "@slock/slack";

export interface OutlineItem {
  index: number;
  level: number;
  text: string;
}

export interface OutlineSource {
  elements(): (HTMLElement | null)[];
  items(): OutlineItem[];
}

export function titleItem(title: string): OutlineItem {
  return { index: 0, level: 0, text: encodeTextEntities(title.trim()) };
}

const HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6";

export function headingElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)];
}

export function outlineFromDom(root: HTMLElement): OutlineItem[] {
  return headingElements(root).map((heading, index) => ({
    index: index + 1,
    level: Number(heading.tagName.slice(1)),
    text: encodeTextEntities(heading.textContent?.trim() ?? ""),
  }));
}
