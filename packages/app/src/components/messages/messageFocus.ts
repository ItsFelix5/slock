import type { Message } from "@slock/types";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { isMine } from "../../lib/api";
import { store } from "../../lib/store";
import { findUnreadDividerIndex } from "./lib/unreadDivider";

export interface OpenThreadOptions {
  pinned?: boolean;
}

export type OpenThreadHandler = (ts: string, opts?: OpenThreadOptions) => void;

export interface MessageFocusCallbacks {
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;

  threadTs?: Accessor<string | undefined>;
}

export interface ActiveMessageFocus {
  callbacks: MessageFocusCallbacks;
  channelId: Accessor<string>;
  focusEdge: (edge: "start" | "end") => void;
  focusedMessage: () => Message | undefined;
  focusedTs: Accessor<string | null>;
  isOwnEditableMessage: () => boolean;
  moveFocus: (delta: number) => void;
  startEdit: (ts: string) => void;
  toggleMoreMenu: (ts: string) => void;
  toggleReactionPicker: (ts: string) => void;
}

const [active, setActive] = createSignal<ActiveMessageFocus>();

export { active };

export function createMessageFocus(
  messages: Accessor<Message[]>,
  container: Accessor<HTMLElement | undefined>,
  channelId: Accessor<string>,
  callbacks: MessageFocusCallbacks = {},
) {
  const [focusedTs, setFocusedTs] = createSignal<string | null>(null);
  const [editingTs, setEditingTs] = createSignal<string | null>(null);
  const [listFocused, setListFocused] = createSignal(false);
  const [reactionPickerTs, setReactionPickerTs] = createSignal<string | null>(null);
  const [moreMenuTs, setMoreMenuTs] = createSignal<string | null>(null);

  createEffect(() => {
    const list = messages();
    const current = focusedTs();
    if (!list.length) {
      if (current !== null) setFocusedTs(null);
      return;
    }
    if (current === null || !list.some((m) => m.ts === current)) {
      const anchor = store.unread.unreadDividerTsForChannel(channelId());
      const unreadIndex = findUnreadDividerIndex(list, anchor);
      setFocusedTs(list[unreadIndex >= 0 ? unreadIndex : list.length - 1].ts);
    }
  });

  function focusRow(ts: string, opts?: { preventScroll?: boolean }) {
    setFocusedTs(ts);
    const row = container()?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    if (opts?.preventScroll) row?.focus({ preventScroll: true });
    else {
      row?.focus();
      row?.scrollIntoView({ block: "nearest" });
    }
  }

  function moveFocus(delta: number) {
    const list = messages();
    if (!list.length) return;
    const currentIndex = list.findIndex((m) => m.ts === focusedTs());
    const nextIndex = Math.max(
      0,
      Math.min(list.length - 1, currentIndex < 0 ? list.length - 1 : currentIndex + delta),
    );
    const next = list[nextIndex];
    if (!next) return;
    if (nextIndex === list.length - 1) focusEdge("end");
    else focusRow(next.ts);
  }

  function focusEdge(edge: "start" | "end") {
    const list = messages();
    if (!list.length) return;
    focusRow(list[edge === "start" ? 0 : list.length - 1].ts);
    const scroller = container();
    if (scroller) scroller.scrollTop = edge === "start" ? 0 : scroller.scrollHeight;
  }

  const focusedMessage = () => {
    const ts = focusedTs();
    return ts === null ? undefined : messages().find((m) => m.ts === ts);
  };

  const isOwnEditableMessage = () => {
    const msg = focusedMessage();
    if (!msg || msg.deleted || msg.isEphemeral) return false;
    return isMine(msg);
  };

  const startEdit = (ts: string) => {
    setFocusedTs(ts);
    setEditingTs(ts);
  };
  const stopEdit = () => setEditingTs(null);

  const toggleReactionPicker = (ts: string) =>
    setReactionPickerTs((current) => (current === ts ? null : ts));

  const toggleMoreMenu = (ts: string) => {
    if (moreMenuTs() !== ts) store.resources.loadMessageShortcuts();
    setMoreMenuTs((current) => (current === ts ? null : ts));
  };

  const self: ActiveMessageFocus = {
    callbacks,
    channelId,
    focusEdge,
    focusedMessage,
    focusedTs,
    isOwnEditableMessage,
    moveFocus,
    startEdit,
    toggleMoreMenu,
    toggleReactionPicker,
  };
  const deactivate = () => setActive((current) => (current === self ? undefined : current));
  onCleanup(deactivate);

  return {
    editingTs,
    focusEdge,
    focusMessage: (ts: string) => focusRow(ts, { preventScroll: true }),
    focusedTs,

    listFocused,
    onContainerFocusIn: (e: FocusEvent) => {
      setListFocused(true);
      setActive(self);

      const target = e.target instanceof Element ? e.target : null;
      const ts = target?.closest<HTMLElement>("[data-message-ts]")?.dataset.messageTs;
      if (ts) setFocusedTs(ts);
    },
    onContainerFocusOut: (e: FocusEvent & { currentTarget: HTMLElement }) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) {
        setListFocused(false);
        deactivate();
      }
    },
    onStartEdit: startEdit,
    onStopEdit: stopEdit,
    onToggleMoreMenu: toggleMoreMenu,
    onToggleReactionPicker: toggleReactionPicker,
    moreMenuTs,
    reactionPickerTs,
  };
}
