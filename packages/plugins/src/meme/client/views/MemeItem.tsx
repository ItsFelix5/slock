import { service } from "@slock/core/solid";
import type { MessageMenuProps } from "@slock/plugins/messages/client/api";
import { MenuItem } from "@slock/ui";
import { For } from "solid-js";
import { memeSources } from "../lib/sources";

const meme = service("meme");

export default function MemeItem(props: MessageMenuProps) {
  const sources = () => memeSources(props.msg);
  return (
    <For each={sources()}>
      {(source) => (
        <MenuItem
          icon="image"
          onClick={() => {
            props.close();
            meme.open({ channelId: props.channelId, source, threadTs: props.threadTs });
          }}
        >
          {sources().length > 1 ? `Make a meme from ${source.name}` : "Make a meme"}
        </MenuItem>
      )}
    </For>
  );
}
