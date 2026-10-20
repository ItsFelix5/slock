import { EmojiText } from "@slock/blockkit";
import { formatTimeFromMs } from "@slock/core";
import { blockPreviewText } from "@slock/slack";
import {
  Icon,
  type ListDirection,
  listNavigationIndex,
  SuggestionList,
  useClickOutside,
  useEscapeClose,
  useListShortcuts,
  useShortcut,
} from "@slock/ui";
import { createMemo, createSignal, Show } from "solid-js";
import type { DraftValue } from "../../../../drafts/client/api";
import "./DraftsMenu.css";

function relativeLabel(ts: string | undefined): string {
  if (!ts) return "";
  const ms = Number(ts) * 1000;
  if (!Number.isFinite(ms)) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const d = new Date(ms);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? formatTimeFromMs(ms)
    : d.toLocaleDateString([], { day: "numeric", month: "short" });
}

type ActionRow = { kind: "save-new" | "save-template" };
type Row = { kind: "entry"; entry: DraftValue } | ActionRow;

export default function DraftsMenu(props: {
  hasContent: boolean;
  onClose: () => void;
  onDelete: (entry: DraftValue) => Promise<void>;
  onSaveAndStartNew: () => void;
  onSaveAsTemplate: (name: string) => void;
  onSwitchTo: (entry: DraftValue) => void;
  stack: DraftValue[];
}) {
  const [naming, setNaming] = createSignal(false);
  const [name, setName] = createSignal("");
  const [active, setActive] = createSignal<number | null>(null);
  let inputRef: HTMLInputElement | undefined;

  useEscapeClose(() => (naming() ? setNaming(false) : props.onClose()));
  useClickOutside(".composer-drafts-menu", props.onClose);

  const rows = createMemo<Row[]>(() => {
    const entries: Row[] = props.stack.map((entry) => ({ entry, kind: "entry" }));
    if (props.hasContent) {
      entries.push({ kind: "save-new" });
      entries.push({ kind: "save-template" });
    }
    return entries;
  });

  const submitName = (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) return;
    props.onSaveAsTemplate(trimmed);
    props.onClose();
  };

  const pick = (row: Row) => {
    if (row.kind === "entry") {
      props.onSwitchTo(row.entry);
      props.onClose();
    } else if (row.kind === "save-new") {
      props.onSaveAndStartNew();
      props.onClose();
    } else {
      setNaming(true);
      queueMicrotask(() => inputRef?.focus());
    }
  };

  const move = (direction: ListDirection) => {
    const next = listNavigationIndex(direction, active(), rows().length, { wrap: true });
    if (next !== undefined) setActive(next);
  };
  const submit = () => {
    const index = active();
    const row = index === null ? undefined : rows()[index];
    if (row) pick(row);
  };
  const activeEntry = () => {
    const index = active();
    const row = index === null ? undefined : rows()[index];
    return row?.kind === "entry" ? row.entry : undefined;
  };
  const remove = async (entry: DraftValue) => {
    await props.onDelete(entry);
    if (rows().length === 0) props.onClose();
    else setActive((index) => (index === null ? null : Math.min(index, rows().length - 1)));
  };
  useShortcut({
    allowInInputs: true,
    combo: { key: "Delete" },
    enabled: () => !naming() && !!activeEntry(),
    handler: () => {
      const entry = activeEntry();
      if (entry) void remove(entry);
    },
    id: "composer.drafts.delete",
    label: "Delete highlighted draft",
    scope: "composer",
    group: "Message box",
  });
  for (const manual of [false, true]) {
    useListShortcuts({ allowInInputs: true, enabled: () => !naming(), manual, move, submit });
  }

  const renderRow = (row: Row) => {
    switch (row.kind) {
      case "entry":
        return (
          <>
            <span class="suggestion-icon flex-center">
              <Icon name="stacked-cards" size={13} />
            </span>
            <span class="suggestion-label truncate">
              <EmojiText text={blockPreviewText(row.entry.blocks)} />
            </span>
            <span class="suggestion-desc truncate">{relativeLabel(row.entry.lastUpdatedTs)}</span>
          </>
        );
      case "save-new":
        return (
          <>
            <span class="suggestion-icon flex-center">
              <Icon name="save" size={13} />
            </span>
            <span class="suggestion-label truncate">Save and start new draft</span>
          </>
        );
      case "save-template":
        return (
          <>
            <span class="suggestion-icon flex-center">
              <Icon name="bookmark" size={13} />
            </span>
            <span class="suggestion-label truncate">Save as template</span>
          </>
        );
    }
  };

  return (
    <Show when={rows().length > 0}>
      <div class="composer-drafts-menu menu-panel composer-suggest-popover composer-suggest-docked">
        <Show
          fallback={
            <form class="composer-drafts-name-form flex-align-center" onSubmit={submitName}>
              <input
                class="text-field"
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Template name"
                ref={inputRef}
                type="text"
                value={name()}
              />
              <button
                class="btn-reset composer-drafts-name-submit"
                disabled={!name().trim()}
                type="submit"
              >
                <Icon name="check" size={14} />
              </button>
            </form>
          }
          when={!naming()}
        >
          <SuggestionList
            activeIndex={active()}
            class="composer-suggest-scroll"
            items={rows()}
            onHover={setActive}
            onPick={(i) => {
              const row = rows()[i];
              if (row) pick(row);
            }}
            renderAction={(row) =>
              row.kind === "entry" ? (
                <button
                  class="btn-reset icon-btn sm icon-action text-dim suggestion-action"
                  aria-label="Delete draft"
                  onClick={() => void remove(row.entry)}
                  onMouseDown={(e) => e.preventDefault()}
                  type="button"
                >
                  <Icon name="trash" size={13} />
                </button>
              ) : null
            }
            renderItem={renderRow}
          />
        </Show>
      </div>
    </Show>
  );
}
