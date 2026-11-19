const callbacks = new WeakMap<Element, (overflowing: boolean) => void>();

const observer = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    callbacks.get(target)?.(target.scrollHeight - target.clientHeight > 2);
  }
});

export function observeOverflow(el: Element, onChange: (overflowing: boolean) => void) {
  callbacks.set(el, onChange);
  observer.observe(el);
  return () => {
    observer.unobserve(el);
    callbacks.delete(el);
  };
}
