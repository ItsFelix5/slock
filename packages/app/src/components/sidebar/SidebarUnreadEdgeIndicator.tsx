import { Icon } from "@slock/ui";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import "./SidebarUnreadEdgeIndicator.css";

function unreadRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".sidebar-row.unread")];
}

export default function SidebarUnreadEdgeIndicator(props: {
  containerRef: () => HTMLDivElement | undefined;
}) {
  const [above, setAbove] = createSignal(false);
  const [below, setBelow] = createSignal(false);

  function recompute() {
    const container = props.containerRef();
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    let hasAbove = false;
    let hasBelow = false;
    for (const row of unreadRows(container)) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom <= bounds.top) hasAbove = true;
      else if (rect.top >= bounds.bottom) hasBelow = true;
    }
    setAbove(hasAbove);
    setBelow(hasBelow);
  }

  function scrollToward(direction: -1 | 1) {
    const container = props.containerRef();
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    const rows = unreadRows(container);
    const target =
      direction === -1
        ? rows.filter((row) => row.getBoundingClientRect().bottom <= bounds.top).at(-1)
        : rows.find((row) => row.getBoundingClientRect().top >= bounds.bottom);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  onMount(() => {
    const container = props.containerRef();
    if (!container) return;
    recompute();
    container.addEventListener("scroll", recompute, { passive: true });
    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(container);
    const mutationObserver = new MutationObserver(recompute);
    mutationObserver.observe(container, {
      attributeFilter: ["class"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    onCleanup(() => {
      container.removeEventListener("scroll", recompute);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    });
  });

  return (
    <>
      <Show when={above()}>
        <button
          class="sidebar-unread-edge sidebar-unread-edge-top"
          onClick={() => scrollToward(-1)}
          title="Unread channels above"
          type="button"
        >
          <Icon name="caret-up-filled" size={12} />
        </button>
      </Show>
      <Show when={below()}>
        <button
          class="sidebar-unread-edge sidebar-unread-edge-bottom"
          onClick={() => scrollToward(1)}
          title="Unread channels below"
          type="button"
        >
          <Icon name="caret-down-filled" size={12} />
        </button>
      </Show>
    </>
  );
}
