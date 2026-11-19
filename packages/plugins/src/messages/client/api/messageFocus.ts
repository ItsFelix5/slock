import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { ifPresent, parseTs } from "@slock/slack";
import type { ChannelId, Message, Ts } from "@slock/types";
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js";
import { findUnreadDividerIndex } from "../lib/unreadDivider";
import type { FeedScroll } from "./pane/scroll/feedScroll";

const unreadStore = service("unread");

export interface OpenThreadOptions {
  pinned?: boolean;
}

export function threadRootTs(msg: Message) {
  return msg.isBroadcast && msg.threadTs ? msg.threadTs : msg.ts;
}

export type OpenThreadHandler = (ts: Ts, opts?: OpenThreadOptions) => void;

export interface MessageFocusCallbacks {
  paneId?: string;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;

  threadTs?: Accessor<Ts | undefined>;
}

export interface ActiveMessageFocus {
  callbacks: MessageFocusCallbacks;
  channelId: Accessor<ChannelId>;
  focusEdge: (edge: "start" | "end") => void;
  focusedMessage: () => Message | undefined;
  focusedLiveTs: Accessor<Ts | null>;
  focusedTs: Accessor<Ts | null>;
  isOwnEditableMessage: () => boolean;
  moveFocus: (delta: number) => void;
  startEdit: (ts: Ts) => void;
  toggleMoreMenu: (ts: Ts) => void;
  toggleReactionPicker: (ts: Ts) => void;
}

const [active, setActive] = createSignal<ActiveMessageFocus>();
const editLastByPane = new Map<string, () => void>();

export { active };

export function editLastMessageInPane(paneId: string) {
  editLastByPane.get(paneId)?.();
}

export function clearActiveMessageFocus() {
  setActive(undefined);
}

export function createMessageFocus(
  messages: Accessor<Message[]>,
  feed: FeedScroll,
  channelId: Accessor<ChannelId>,
  callbacks: MessageFocusCallbacks = {},
) {
  const [focusedTs, setFocusedTs] = createSignal<Ts | null>(null);
  const [editingTs, setEditingTs] = createSignal<Ts | null>(null);
  const [listFocused, setListFocused] = createSignal(false);
  const [reactionPickerTs, setReactionPickerTs] = createSignal<Ts | null>(null);
  const [moreMenuTs, setMoreMenuTs] = createSignal<Ts | null>(null);

  createEffect(
    () => ({
      anchor: unreadStore.unreadDividerTsForChannel(channelId()),
      current: focusedTs(),
      list: messages(),
    }),
    ({ anchor, current, list }) => {
      if (!list.length) {
        if (current !== null) setFocusedTs(null);
        return;
      }
      if (current === null || !list.some((m) => m.ts === current)) {
        const unreadIndex = findUnreadDividerIndex(list, anchor);
        setFocusedTs(defined(list[unreadIndex >= 0 ? unreadIndex : list.length - 1]).ts);
      }
    },
  );

  function focusRow(ts: Ts, opts?: { preventScroll?: boolean }) {
    setFocusedTs(ts);
    const row = feed.element()?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    row?.focus({ preventScroll: true });
    if (!opts?.preventScroll) feed.reveal(ts);
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
    focusRow(defined(list[edge === "start" ? 0 : list.length - 1]).ts, { preventScroll: true });
    feed.scrollEdge(edge);
  }

  const focusedMessage = () => {
    const ts = focusedTs();
    return ts === null ? undefined : messages().find((m) => m.ts === ts);
  };

  const focusedLiveTs = () => (focusedMessage()?.deleted ? null : focusedTs());

  const isEditable = (msg: Message) =>
    !(msg.deleted || msg.isEphemeral) && service("messages").isMine(msg);

  const isOwnEditableMessage = () => {
    const msg = focusedMessage();
    return !!msg && isEditable(msg);
  };

  const startEdit = (ts: Ts) => {
    setFocusedTs(ts);
    setEditingTs(ts);
  };
  const stopEdit = () => setEditingTs(null);

  const { paneId } = callbacks;
  if (paneId) {
    const editLast = () => {
      const last = messages().findLast(isEditable);
      if (last) startEdit(last.ts);
    };
    editLastByPane.set(paneId, editLast);
    onCleanup(() => {
      if (editLastByPane.get(paneId) === editLast) editLastByPane.delete(paneId);
    });
  }

  const toggleReactionPicker = (ts: Ts) =>
    setReactionPickerTs((current) => (current === ts ? null : ts));

  const toggleMoreMenu = (ts: Ts) => {
    setMoreMenuTs((current) => (current === ts ? null : ts));
  };

  const self: ActiveMessageFocus = {
    callbacks,
    channelId,
    focusEdge,
    focusedLiveTs,
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
    focusMessage: (ts: Ts) => focusRow(ts, { preventScroll: true }),
    focusedTs,

    listFocused,
    onContainerFocusIn: (e: FocusEvent) => {
      setListFocused(true);
      setActive(self);

      const target = e.target instanceof Element ? e.target : null;
      const ts = ifPresent(
        parseTs,
        target?.closest<HTMLElement>("[data-message-ts]")?.dataset.messageTs,
      );
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
