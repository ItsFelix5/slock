import { createSignal, onCleanup } from "solid-js";
import { type MountHandle, mountQueue } from "../mountQueue";

const NEAR_VIEWPORT = "200px";

const handles = new WeakMap<Element, MountHandle>();

const observer =
  typeof IntersectionObserver === "undefined"
    ? undefined
    : new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) handles.get(entry.target)?.promote();
        },
        { rootMargin: NEAR_VIEWPORT },
      );

export function useDeferredMount() {
  const [ready, setReady] = createSignal(false);
  let release = () => {};

  const now = () => {
    release();
    setReady(true);
  };

  const ref = (el: HTMLElement) => {
    const handle = mountQueue.add(now);
    handles.set(el, handle);
    observer?.observe(el);
    release = () => {
      observer?.unobserve(el);
      handles.delete(el);
      handle.cancel();
    };
  };

  onCleanup(() => release());

  return { now, ready, ref };
}
