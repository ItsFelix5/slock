import { service } from "@slock/core/solid";
import type { MessageShortcut } from "@slock/types";
import { fuzzySearch, Icon, Menu, MenuItem } from "@slock/ui";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Show } from "solid-js";
import type { MessageMenuProps } from "../../../messages/client/api";
import { defineKey } from "../../../query/client/api";
import { fetchMessageShortcuts } from "../../../slack/client/api";
import { runShortcut } from "../runShortcut";

const messageShortcutsKey = defineKey<[]>("messageShortcuts");

const query = service("query");

export default function ShortcutsMenu(props: MessageMenuProps) {
  const shortcuts = createQuery(
    () => ({ queryFn: fetchMessageShortcuts, queryKey: messageShortcutsKey() }),
    () => query.client,
  );
  const [open, setOpen] = createSignal(false);
  const [search, setSearch] = createSignal("");

  const filtered = createMemo(() => {
    const all: MessageShortcut[] = shortcuts.data ?? [];
    const text = search().trim();
    if (!text) return all;
    return fuzzySearch(all, { altText: (s) => s.appName, query: text, text: (s) => s.name });
  });
  const close = () => {
    setOpen(false);
    setSearch("");
  };
  const toggle = () => (open() ? close() : setOpen(true));
  const run = (shortcut: MessageShortcut) => {
    close();
    props.close();
    void runShortcut(props.channelId, props.msg.ts, shortcut);
  };

  return (
    <>
      <Show when={shortcuts.isFetching}>
        <div aria-live="polite" class="menu-item disabled">
          <Icon name="apps" size={15} />
          Loading shortcuts…
        </div>
      </Show>
      <Show when={shortcuts.error}>
        <MenuItem icon="refresh" onClick={() => void shortcuts.refetch()}>
          Retry
        </MenuItem>
      </Show>
      <Show when={shortcuts.data?.length}>
        <Menu
          class="message-more-item-wrap"
          onClose={close}
          open={open()}
          panelClass="menu-panel message-shortcuts-menu"
          placement="left"
          trigger={
            <MenuItem icon="apps" onClick={toggle}>
              Message shortcuts
            </MenuItem>
          }
        >
          <input
            autofocus
            class="text-field"
            onInput={(e) => setSearch(e.currentTarget.value)}
            placeholder="Search shortcuts"
            type="text"
            value={search()}
          />
          <div class="message-shortcuts-list flex-col">
            <For
              each={filtered()}
              fallback={<div class="message-shortcuts-empty">No matching shortcuts</div>}
            >
              {(shortcut) => (
                <MenuItem
                  leading={
                    <Show fallback={<Icon name="apps" size={15} />} when={shortcut.icon}>
                      {(icon) => <img alt="" class="menu-item-app-icon" src={icon()} />}
                    </Show>
                  }
                  onClick={() => run(shortcut)}
                >
                  {shortcut.name}
                </MenuItem>
              )}
            </For>
          </div>
        </Menu>
      </Show>
    </>
  );
}
