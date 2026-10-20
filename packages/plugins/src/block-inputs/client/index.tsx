import type { Setup } from "@slock/core";
import { createSignal } from "solid-js";
import { createEntitySource } from "./entitySource";
import FileInput from "./FileInput";

const setup: Setup = (ctx) => {
  const [lastOpened, setLastOpened] = createSignal<string>();
  ctx.add("conversations.opened", (view) => setLastOpened(view.id));
  ctx.add("blockkit.entitySource", createEntitySource(lastOpened));
  ctx.add("blockkit.fileInput", FileInput);
};

export default setup;
