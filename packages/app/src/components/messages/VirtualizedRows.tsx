import { logDeletedMessages, messageSize } from "@slock/ui";
import { createVirtualizer } from "@tanstack/solid-virtual";
import type { ScrollToOptions } from "@tanstack/virtual-core";
import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { isDragSelecting } from "../../lib/messageHoverDragGuard";
import { store } from "../../lib/store";
import MessageRow from "./MessageRow";
import type { MessageRowsProps } from "./MessageRows";
import { estimateMessageHeight } from "./parts/estimateMessageHeight";

// Imperative handle handed up to MessageList.tsx (see props.onApi) — it owns
// scroll-landing decisions (unread divider, jump-to-message, initial open)
// but needs the virtualizer to actually move to an index that may currently
// be far outside the rendered window.
export interface VirtualRowsApi {
  scrollToIndex: (index: number, opts?: ScrollToOptions) => void;
  itemSize: (index: number) => number | undefined;
  // Offset from the top of the content to the start of a row — used to
  // measure how tall everything from a given row to the end still is
  // (totalSize() - itemStart(index)).
  itemStart: (index: number) => number | undefined;
  // Total content height — MessageList.tsx watches this to notice a
  // late-arriving embed/image growing an already-rendered row (not just a
  // new message being appended) so it can keep following the bottom.
  totalSize: () => number;
  // Index of the row currently nearest the top of the viewport — drives the
  // sticky date header showing which day is in view.
  topVisibleIndex: () => number | undefined;
}

export default function VirtualizedRows(props: MessageRowsProps) {
  // Cached so estimateSize (called in a hot measurement loop) doesn't force a
  // layout read of clientWidth on every call; refreshed only on real resizes.
  const [width, setWidth] = createSignal(props.scrollContainer?.()?.clientWidth ?? 640);
  onMount(() => {
    const el = props.scrollContainer?.();
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  const estimateRowSize = (index: number) =>
    estimateMessageHeight(props.messages[index], props.messages[index - 1], width(), {
      channelId: props.channelId,
      hasOpenThread: !!props.onOpenThread,
      isPinned: store.pinned.isMessagePinned(props.channelId, props.messages[index]?.ts ?? ""),
      messageSize: messageSize(),
      messages: props.messages,
      showDeleted: logDeletedMessages(),
      threadTs: props.threadTs,
      unreadDividerTs: store.unread.unreadDividerTsForChannel(props.channelId),
    });

  const virtualizer = createVirtualizer({
    estimateSize: estimateRowSize,
    getItemKey: (index) => props.messages[index]?.ts ?? index,
    getScrollElement: () => props.scrollContainer?.() ?? null,
    // A row near the loaded window's edge sits close to the scroll
    // container's own edge too, so a text-selection drag that crosses it can
    // trigger the browser's native auto-scroll-while-selecting — which fires
    // real scroll events and, at the normal overscan, unmounts the row the
    // selection's anchor/focus lives in mid-drag (see
    // messageHoverDragGuard.ts's isDragSelecting doc comment for what that
    // does to the selection). Rendering every row for the drag's duration
    // means there's nothing for a mid-drag scroll to unmount.
    get overscan() {
      return isDragSelecting() ? props.messages.length : 8;
    },
    // The virtualized rows sit below a variable-height header (loading
    // indicator / channel intro) inside the same scroll container; without
    // this the virtualizer treats item offsets as starting at scrollTop 0, so
    // scrollToIndex and range math drift by the header's height.
    get scrollMargin() {
      return props.scrollMargin ?? 0;
    },
    // "end" anchoring gives us two things for free, both driven by item keys
    // rather than raw scrollHeight math: prepending older history keeps
    // whatever's on screen visually still (it re-anchors on the key that was
    // at the top of the viewport), and a resize of an already-at-the-bottom
    // row (an image/embed finishing load) keeps the view pinned to the
    // bottom. followOnAppend covers the third case — a genuinely new
    // trailing message arriving while already at the bottom.
    get anchorTo() {
      return props.anchorTo ?? "end";
    },
    get followOnAppend() {
      return props.followOnAppend ?? "auto";
    },
    // How close to the bottom still counts as "at the bottom" for the above
    // two behaviors — matches the old hand-rolled NEAR_BOTTOM_PX threshold.
    scrollEndThreshold: 120,
    get count() {
      return props.messages.length;
    },
  });

  // this component never remounts on channel switch (parent Show isn't
  // keyed), and tanstack-virtual only invalidates its measurement cache when
  // count/getItemKey change identity - not when they return different
  // values. same message count across two channels meant the old channel's
  // row heights got reused for the new one, causing overlap/gaps on switch.
  // measure() only invalidates (sizes fall back to estimates) - the actual
  // re-measuring of reused rows is the per-row key-change effect in the ref
  // below
  createEffect(
    on(
      () => props.channelId,
      () => virtualizer.measure(),
    ),
  );

  let reactionLayouts = new Map<string, string>();
  createEffect(() => {
    const nextLayouts = new Map<string, string>();
    for (const message of props.messages) {
      const layout = (message.reactions ?? [])
        .map((reaction) => {
          const visibleAvatars = reaction.users
            .slice(0, 3)
            .filter((id) => store.users.userById(id) !== undefined).length;
          return `${reaction.name}:${reaction.count}:${reaction.users.join(",")}:${visibleAvatars}`;
        })
        .join("|");
      nextLayouts.set(message.ts, layout);

      const previous = reactionLayouts.get(message.ts);
      if (previous === undefined || previous === layout) continue;

      queueMicrotask(() => {
        const index = props.messages.findIndex((candidate) => candidate.ts === message.ts);
        if (index < 0) return;
        const key = virtualizer.options.getItemKey(index);
        const element = virtualizer.elementsCache.get(key) as HTMLElement | undefined;
        virtualizer.resizeItem(index, element?.offsetHeight ?? estimateRowSize(index));
      });
    }
    reactionLayouts = nextLayouts;
  });

  props.onApi?.({
    itemSize: (index) => virtualizer.measurementsCache[index]?.size,
    itemStart: (index) => virtualizer.measurementsCache[index]?.start,
    scrollToIndex: (index, opts) => virtualizer.scrollToIndex(index, opts),
    totalSize: () => virtualizer.getTotalSize(),
    // getVirtualItems()[0] is the first *overscanned* row (overscan: 8 above),
    // not the first one actually below the viewport's top edge — using it
    // directly made the date pill show a day that had already scrolled out of
    // view. item.start is in the same coordinate space as scrollTop (both
    // measured from the scroll container's top, including scrollMargin), so
    // find the first item whose bottom edge hasn't passed scrollTop yet.
    topVisibleIndex: () => {
      const scrollTop = props.scrollContainer?.()?.scrollTop ?? 0;
      return virtualizer.getVirtualItems().find((item) => item.start + item.size > scrollTop)
        ?.index;
    },
  });

  return (
    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative", width: "100%" }}>
      <For each={virtualizer.getVirtualItems()}>
        {(item) => (
          <Show when={item && props.messages[item.index]}>
            {(message) => (
              <div
                data-index={item.index}
                ref={(el) => {
                  // Set explicitly (not just left to the data-index JSX
                  // binding above) so there's no ambiguity about whether
                  // it's applied before this ref runs — measureElement
                  // reads it immediately via indexFromElement, and if it's
                  // ever missing/stale that call silently no-ops (wrong
                  // index resolves to -1, which resizeItem guards on) and,
                  // worse, collapses this row's elementsCache entry onto
                  // whatever key -1 last resolved to, permanently losing
                  // this row's own ResizeObserver subscription. That's
                  // what was pinning every row at its raw text-estimate
                  // height regardless of its real (image/embed) content.
                  el.dataset.index = String(item.index);
                  virtualizer.measureElement(el);
                  // solid-virtual reconciles virtual items keyed by index, so
                  // a channel switch (or history prepend) reuses this element
                  // in place for a different message - the ref never reruns,
                  // the virtualizer still has it registered under the old
                  // message's key, and its ResizeObserver only fires if the
                  // swapped-in content happens to change the height. a key
                  // whose row never re-measures stays at its raw estimate
                  // (rows overlapping on open) until the row scrolls out and
                  // remounts. re-register and force a real measurement on
                  // every key change, and drop the stale cache entry so a
                  // later mount of the old key can't steal this element's
                  // observer subscription
                  createEffect(
                    on(
                      () => item.key,
                      (_key, prevKey) => {
                        if (prevKey !== undefined && virtualizer.elementsCache.get(prevKey) === el)
                          virtualizer.elementsCache.delete(prevKey);
                        virtualizer.measureElement(el);
                        // measureElement skips its synchronous measure while a
                        // scroll is in flight; resizeItem directly so the swap
                        // can never be left sitting on an estimate
                        virtualizer.resizeItem(item.index, el.offsetHeight);
                      },
                      { defer: true },
                    ),
                  );
                  // Solid refs (unlike React's) never fire again with `null`
                  // on unmount, so without this the virtualizer's own
                  // ResizeObserver only notices a scrolled-away row went
                  // stale the next time *any* observed row happens to
                  // resize — onCleanup makes that immediate instead of an
                  // incidental, unbounded-delay sweep.
                  onCleanup(() => virtualizer.measureElement(null));
                }}
                style={{
                  left: 0,
                  position: "absolute",
                  top: 0,
                  // item.start is measured from the scroll container's top
                  // (it includes scrollMargin); subtract it back out to place
                  // the row within this container, which itself sits at
                  // scrollMargin.
                  transform: `translateY(${item.start - (props.scrollMargin ?? 0)}px)`,
                  width: "100%",
                }}
              >
                <MessageRow
                  channelId={props.channelId}
                  editingTs={props.editingTs}
                  focusedTs={props.focusedTs}
                  index={() => item.index}
                  listFocused={props.listFocused}
                  message={message()}
                  messages={props.messages}
                  onJumpToMessage={props.onJumpToMessage}
                  onOpenThread={props.onOpenThread}
                  onReplyLink={props.onReplyLink}
                  onStartEdit={props.onStartEdit}
                  onStopEdit={props.onStopEdit}
                  threadTs={props.threadTs}
                />
              </div>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}
