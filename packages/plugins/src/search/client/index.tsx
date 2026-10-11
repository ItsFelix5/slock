import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { IconButton, useShortcut } from "@slock/ui";
import { createSignal, lazy, Show } from "solid-js";
import { consumeShareTarget, pendingShareText } from "../../message-links/client/api/incomingLinks";
import { createSearchStore } from "./store";

const GlobalSearch = lazy(() => import("./views/GlobalSearch"));
const MessageSearchView = lazy(() => import("./views/MessageSearchView"));

const setup: Setup = (ctx) => {
  const sidebar = service("sidebar");
  const search = createSearchStore({ showScreen: () => sidebar.setNavView("search") });
  ctx.provide("search", search);
  consumeShareTarget();
  const [open, setOpen] = createSignal(!!pendingShareText());
  const files = service("files");

  useShortcut({
    allowInInputs: true,
    combo: { key: "k", mod: true },
    group: "Channels and search",
    handler: () => setOpen(true),
    id: "sidebar.quickSwitcher",
    label: "Quick Switcher",
    scope: "general",
  });
  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    combo: { key: "g", mod: true },
    group: "Channels and search",
    handler: () => search.openSearch(""),
    id: "sidebar.searchMessages",
    label: "Search all messages",
    scope: "general",
  });

  ctx.add(
    "sidebar.nav",
    {
      button: () => null,
      feed: true,
      hidden: true,
      id: "search",
      label: "Search",
      view: MessageSearchView,
    },
    { order: 30 },
  );
  ctx.add(
    "sidebar.toolbar",
    () => (
      <IconButton
        class="sidebar-global-search-btn icon-shift"
        icon="search"
        onClick={() => setOpen(true)}
      />
    ),
    { order: 30 },
  );
  ctx.add("shell.overlay", () => (
    <>
      <Show when={open()}>
        <GlobalSearch onClose={() => setOpen(false)} onFile={files.open} />
      </Show>
    </>
  ));
};

export default setup;
