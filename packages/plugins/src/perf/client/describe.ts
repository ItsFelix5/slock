const MAX_CLASSES = 2;

function label(element: Element): string {
  const id = element.id ? `#${element.id}` : "";
  const classes = [...element.classList]
    .slice(0, MAX_CLASSES)
    .map((name) => `.${name}`)
    .join("");
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

export function describe(node: Node | null): string {
  if (!(node instanceof Element)) return "unknown";
  const own = label(node);
  if (node.id || node.classList.length) return own;
  const anchor = node.parentElement?.closest("[id], [class]");
  return anchor ? `${own} in ${label(anchor)}` : own;
}
