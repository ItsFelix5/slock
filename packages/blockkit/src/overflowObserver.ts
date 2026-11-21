export function observeOverflow(el: Element, onChange: (overflowing: boolean) => void) {
  const observer = new ResizeObserver(() => onChange(el.scrollHeight - el.clientHeight > 2));
  observer.observe(el);
  return () => observer.disconnect();
}
