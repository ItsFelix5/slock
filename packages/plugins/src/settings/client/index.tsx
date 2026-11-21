import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { IconButton } from "@slock/ui";
import { createSignal, Show } from "solid-js";

const SettingsModal = lazyChunk(() => import("./views/SettingsModal"));

const setup: Setup = (ctx) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const [initialTab, setInitialTab] = createSignal<string>();
  const open = (tab?: string) => {
    setInitialTab(tab);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  ctx.provide("settings", { close, isOpen, open });
  ctx.add("shell.overlay", () => (
    <Show when={isOpen()}>
      <SettingsModal initialTab={initialTab()} onClose={close} />
    </Show>
  ));
  ctx.add(
    "sidebar.toolbar",
    () => (
      <IconButton
        class="sidebar-global-search-btn icon-shift"
        icon="settings"
        onClick={() => open()}
      />
    ),
    { order: 20 },
  );
};

export default setup;
