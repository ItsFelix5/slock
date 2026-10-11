import { Icon, Tooltip } from "@slock/ui";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import "./SidebarUnreadEdgeIndicator.css";

function unreadRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(".sidebar-row.unread")];
}

function isMention(row: HTMLElement): boolean {
  return row.querySelector(".sidebar-badge") !== null;
}

export default function SidebarUnreadEdgeIndicator(props: {
  containerRef: () => HTMLDivElement | undefined;
}) {
  const [above, setAbove] = createSignal(false);
  const [below, setBelow] = createSignal(false);
  const [aboveMention, setAboveMention] = createSignal(false);
  const [belowMention, setBelowMention] = createSignal(false);

  function recompute() {
    const container = props.containerRef();
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    let hasAbove = false;
    let hasBelow = false;
    let mentionAbove = false;
    let mentionBelow = false;
    for (const row of unreadRows(container)) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom <= bounds.top) {
        hasAbove = true;
        if (isMention(row)) mentionAbove = true;
      } else if (rect.top >= bounds.bottom) {
        hasBelow = true;
        if (isMention(row)) mentionBelow = true;
      }
    }
    setAbove(hasAbove);
    setBelow(hasBelow);
    setAboveMention(mentionAbove);
    setBelowMention(mentionBelow);
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

  let recomputeRaf = 0;
  function scheduleRecompute() {
    if (recomputeRaf) return;
    recomputeRaf = requestAnimationFrame(() => {
      recomputeRaf = 0;
      recompute();
    });
  }

  onMount(() => {
    const container = props.containerRef();
    if (!container) return;
    recompute();
    container.addEventListener("scroll", scheduleRecompute, { passive: true });
    window.addEventListener("resize", scheduleRecompute);
    const mutationObserver = new MutationObserver(scheduleRecompute);
    mutationObserver.observe(container, {
      attributeFilter: ["class"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    onCleanup(() => {
      container.removeEventListener("scroll", scheduleRecompute);
      window.removeEventListener("resize", scheduleRecompute);
      mutationObserver.disconnect();
      if (recomputeRaf) cancelAnimationFrame(recomputeRaf);
    });
  });

  return (
    <>
      <Show when={above()}>
        <Tooltip content="Unread channels above">
          <button
            class="sidebar-unread-edge sidebar-unread-edge-top"
            classList={{ mention: aboveMention() }}
            onClick={() => scrollToward(-1)}
            type="button"
          >
            <Icon name="caret-up-filled" size={12} />
          </button>
        </Tooltip>
      </Show>
      <Show when={below()}>
        <Tooltip content="Unread channels below">
          <button
            class="sidebar-unread-edge sidebar-unread-edge-bottom"
            classList={{ mention: belowMention() }}
            onClick={() => scrollToward(1)}
            type="button"
          >
            <Icon name="caret-down-filled" size={12} />
          </button>
        </Tooltip>
      </Show>
    </>
  );
}
