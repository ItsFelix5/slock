import type { Setup } from "@slock/core";
import { IconButton } from "@slock/ui";
import { createSignal } from "solid-js";

export const manifest = {
  id: "example",
  name: "Example Plugin",
  requires: ["settings", "sidebar", "composer", "messages"],
};

export const css = ".hello-count { color: var(--accent); font-weight: 600; }";

const setup: Setup = (ctx) => {
  const [clicks, setClicks] = createSignal(0);
  ctx.add(
    "sidebar.toolbar",
    () => (
      <IconButton
        class="sidebar-global-search-btn icon-shift"
        icon="star"
        onClick={() => setClicks(clicks() + 1)}
      />
    ),
    { order: 100 },
  );
  ctx.add("settings.tab", {
    id: "hello",
    label: "Hello",
    view: () => (
      <>
        <h2>Hello</h2>
        <p class="hello-count">Star icon clicked {clicks()} times</p>
      </>
    ),
  });
  ctx.add("composer.suggest", {
    search: (query) =>
      ["alpha", "beta", "gamma"]
        .filter((word) => word.startsWith(query))
        .map((word) => ({
          description: "Example plugin suggestion",
          id: word,
          insert: word.toUpperCase(),
          label: word,
        })),
    trigger: "$",
  });
  ctx.add("composer.beforeSend", (draft) =>
    draft.text.includes("forbidden")
      ? { cancel: "The example plugin blocked this message." }
      : undefined,
  );
  ctx.add("messages.menu", (props) => (
    <button class="menu-item" onClick={props.close} type="button">
      Hello from a plugin
    </button>
  ));
};

export default setup;
