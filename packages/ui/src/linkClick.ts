// Solid 2 delegates click on body, where link tokens stop propagation. Capture sees it first.
// Editable links are skipped so editors keep their own link editing. Disabled editors have none.
export function onLinkClick(
  handle: (anchor: HTMLAnchorElement, event: MouseEvent) => boolean,
): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return;
    const anchor =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || (anchor.isContentEditable && !anchor.closest(".ql-disabled"))) return;
    if (!handle(anchor, event)) return;
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
