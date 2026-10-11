import { encodeTextEntities } from "@slock/blockkit";

export interface OutlineItem {
  index: number;
  level: number;
  text: string;
}

export interface OutlineSource {
  element(index: number): HTMLElement | null;
  items(): OutlineItem[];
}

export function titleItem(title: string): OutlineItem {
  return { index: 0, level: 0, text: encodeTextEntities(title.trim()) };
}

const HEADING_SELECTOR = "h1,h2,h3,h4,h5,h6";

export function outlineFromDom(root: HTMLElement): OutlineItem[] {
  return [...root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)].map((heading, index) => ({
    index: index + 1,
    level: Number(heading.tagName.slice(1)),
    text: encodeTextEntities(heading.textContent?.trim() ?? ""),
  }));
}

export function headingElement(root: HTMLElement, index: number): HTMLElement | null {
  return root.querySelectorAll<HTMLElement>(HEADING_SELECTOR)[index - 1] ?? null;
}
