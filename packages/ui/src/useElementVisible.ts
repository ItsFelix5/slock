import { createSignal, onCleanup } from "solid-js";

export function useElementVisible(rootMargin = "200px") {
  const [visible, setVisible] = createSignal(false);
  let observer: IntersectionObserver | undefined;

  const ref = (el: HTMLElement | undefined) => {
    observer?.disconnect();
    if (!el || visible()) return;
    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer?.disconnect();
      },
      { rootMargin },
    );
    observer.observe(el);
  };

  onCleanup(() => observer?.disconnect());

  return { ref, visible };
}
