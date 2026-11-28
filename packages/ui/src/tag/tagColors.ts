export const TAG_COLORS = [
  "gray",
  "brown",
  "purple",
  "indigo",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export function parseTagColor(value: unknown): TagColor | undefined {
  return TAG_COLORS.find((color) => color === value);
}

const COLOR_CLASS_PREFIX = "bk-tag-";

export function tagColorClass(color: TagColor) {
  return `${COLOR_CLASS_PREFIX}${color}`;
}

export function tagColorOf(node: Element): TagColor | undefined {
  const className = [...node.classList].find((name) => name.startsWith(COLOR_CLASS_PREFIX));
  return parseTagColor(className?.slice(COLOR_CLASS_PREFIX.length));
}
