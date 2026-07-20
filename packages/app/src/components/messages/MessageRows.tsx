import type { Message } from "@slock/slack-api";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { store } from "../../lib/store";
import MessageRow from "./MessageRow";
import { estimateMessageHeight } from "./parts/estimateMessageHeight";

// How far above/below the viewport rows stay mounted before being swapped
// for a spacer — generous enough that ordinary scrolling (including a fast
// flick) rarely shows a spacer flash while still bounding a long-lived,
// busy channel to a few screens' worth of DOM instead of its entire history.
const OVERSCAN_PX = 1200;

function debugUnreadDivider(channelId: string, messages: Message[]) {
  if (!import.meta.env.DEV) return;
  const anchor = store.unread.unreadDividerTsForChannel(channelId);
  const [first] = messages;
  const latest = messages[messages.length - 1];
  const boundaryIndex =
    anchor == null || !Number.isFinite(anchor)
      ? -1
      : messages.findIndex((msg, index) => {
          const prev = messages[index - 1];
          return (
            parseFloat(msg.ts) * 1000 > anchor && (!prev || parseFloat(prev.ts) * 1000 <= anchor)
          );
        });
  const reason =
    anchor == null
      ? "no-anchor"
      : Number.isFinite(anchor)
        ? boundaryIndex === -1
          ? "anchor-outside-loaded-range"
          : "boundary-found"
        : "sentinel-no-unread-gap";

  console.debug("[slock unread divider]", {
    anchor,
    boundaryIndex,
    boundaryTs: messages[boundaryIndex]?.ts,
    channelId,
    firstTs: first?.ts,
    latestTs: latest?.ts,
    messageCount: messages.length,
    reason,
  });
}

export type MessageRowsProps = {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
  // Only the main channel view opts into windowing (see MessageList.tsx) —
  // a single thread's reply count is small enough that virtualizing it isn't
  // worth the added complexity, so ThreadPanel.tsx just omits these and gets
  // the plain, unwindowed render exactly as before.
  virtualize?: boolean;
  scrollContainer?: () => HTMLElement | undefined;
  // An extra single ts (e.g. a same-view "jump to reply" target — see
  // MessageList.tsx's jumpToMessage) that must stay mounted regardless of
  // viewport, alongside the unread divider/cross-view target this already
  // pins on its own.
  pinnedTs?: () => string | null;
};

export default function MessageRows(props: MessageRowsProps) {
  createEffect(() => {
    if (!props.threadTs) debugUnreadDivider(props.channelId, props.messages);
  });

  return (
    <Show
      fallback={
        <For each={props.messages}>
          {(message, index) => (
            <MessageRow
              channelId={props.channelId}
              index={index}
              message={message}
              messages={props.messages}
              onJumpToMessage={props.onJumpToMessage}
              onOpenThread={props.onOpenThread}
              onReplyLink={props.onReplyLink}
              threadTs={props.threadTs}
            />
          )}
        </For>
      }
      when={props.virtualize && props.scrollContainer}
    >
      <VirtualizedRows {...props} />
    </Show>
  );
}

function VirtualizedRows(props: MessageRowsProps) {
  const heights = new Map<string, number>();
  const [heightTick, setHeightTick] = createSignal(0);
  const [scrollTop, setScrollTop] = createSignal(0);
  const [viewportHeight, setViewportHeight] = createSignal(0);

  createEffect(() => {
    const container = props.scrollContainer?.();
    if (!container) return;
    const onScroll = () => setScrollTop(container.scrollTop);
    onScroll();
    setViewportHeight(container.clientHeight);
    container.addEventListener("scroll", onScroll, { passive: true });
    const sizeObserver = new ResizeObserver(() => setViewportHeight(container.clientHeight));
    sizeObserver.observe(container);
    onCleanup(() => {
      container.removeEventListener("scroll", onScroll);
      sizeObserver.disconnect();
    });
  });

  // Prefix-sum offsets built from each message's real measured height where
  // known, else a text-wrap-aware estimate (see estimateMessageHeight) —
  // recomputed only when the message list or a measured height changes, not
  // per scroll frame.
  const offsets = createMemo(() => {
    heightTick();
    const msgs = props.messages;
    const width = props.scrollContainer?.()?.clientWidth ?? 640;
    const result = new Array<number>(msgs.length + 1);
    result[0] = 0;
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const h = heights.get(msg.ts) ?? estimateMessageHeight(msg, width);
      result[i + 1] = result[i] + h;
    }
    return result;
  });

  function indexAtOffset(target: number): number {
    const o = offsets();
    let lo = 0;
    let hi = o.length - 2;
    if (hi < 0) return 0;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (o[mid + 1] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Rows that scrollAnchor.ts's querySelector/scrollIntoView calls (via
  // MessageList.tsx's unread-divider landing and jump-to-message) need to
  // find in the DOM regardless of where the viewport currently is.
  const pinnedRange = createMemo<{ start: number; end: number } | null>(() => {
    const msgs = props.messages;
    if (msgs.length === 0) return null;
    let start: number | undefined;
    let end: number | undefined;
    const mark = (i: number) => {
      if (i < 0) return;
      start = start === undefined ? i : Math.min(start, i);
      end = end === undefined ? i : Math.max(end, i);
    };
    const anchor = store.unread.unreadDividerTsForChannel(props.channelId);
    if (typeof anchor === "number") {
      mark(
        msgs.findIndex((m, i) => {
          const prev = msgs[i - 1];
          return (
            parseFloat(m.ts) * 1000 > anchor && (!prev || parseFloat(prev.ts) * 1000 <= anchor)
          );
        }),
      );
    }
    const target = store.viewState.channelMessageTarget();
    if (target?.channelId === props.channelId) mark(msgs.findIndex((m) => m.ts === target.ts));
    const extraTs = props.pinnedTs?.();
    if (extraTs) mark(msgs.findIndex((m) => m.ts === extraTs));
    return start === undefined ? null : { end: end as number, start };
  });

  const range = createMemo(() => {
    const msgs = props.messages;
    if (msgs.length === 0) return { end: -1, start: 0 };
    const top = Math.max(0, scrollTop() - OVERSCAN_PX);
    const bottom = scrollTop() + viewportHeight() + OVERSCAN_PX;
    let start = indexAtOffset(top);
    let end = indexAtOffset(bottom);
    const pinned = pinnedRange();
    if (pinned) {
      start = Math.min(start, pinned.start);
      end = Math.max(end, pinned.end);
    }
    return { end: Math.min(msgs.length - 1, end), start: Math.max(0, start) };
  });

  const topSpacerHeight = () => offsets()[range().start] ?? 0;
  const bottomSpacerHeight = () => {
    const o = offsets();
    return (o[o.length - 1] ?? 0) - (o[range().end + 1] ?? 0);
  };

  const windowSlice = createMemo(() => {
    const { start, end } = range();
    if (end < start) return [];
    return props.messages
      .slice(start, end + 1)
      .map((message, i) => ({ index: start + i, message }));
  });

  const resizeObserver = new ResizeObserver((entries) => {
    let changed = false;
    for (const entry of entries) {
      const ts = (entry.target as HTMLElement).dataset.rowTs;
      if (!ts) continue;
      const h = entry.target.getBoundingClientRect().height;
      if (Math.abs((heights.get(ts) ?? 0) - h) > 0.5) {
        heights.set(ts, h);
        changed = true;
      }
    }
    if (changed) setHeightTick((t) => t + 1);
  });
  onCleanup(() => resizeObserver.disconnect());

  function registerRow(ts: string) {
    return (el: HTMLDivElement) => {
      el.dataset.rowTs = ts;
      resizeObserver.observe(el);
      onCleanup(() => resizeObserver.unobserve(el));
    };
  }

  return (
    <>
      <Show when={topSpacerHeight() > 0}>
        <div style={{ height: `${topSpacerHeight()}px` }} />
      </Show>
      <For each={windowSlice()}>
        {(item) => (
          <div ref={registerRow(item.message.ts)}>
            <MessageRow
              channelId={props.channelId}
              index={() => item.index}
              message={item.message}
              messages={props.messages}
              onJumpToMessage={props.onJumpToMessage}
              onOpenThread={props.onOpenThread}
              onReplyLink={props.onReplyLink}
              threadTs={props.threadTs}
            />
          </div>
        )}
      </For>
      <Show when={bottomSpacerHeight() > 0}>
        <div style={{ height: `${bottomSpacerHeight()}px` }} />
      </Show>
    </>
  );
}
