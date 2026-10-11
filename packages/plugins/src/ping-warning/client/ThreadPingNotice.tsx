import { service } from "@slock/core/solid";
import { createMemo, For, Show } from "solid-js";
import type { ComposerProps } from "../../composer/client/api";
import "./ThreadPingNotice.css";

const messages = service("messages");
const usergroups = service("usergroups");

const USERGROUP_MENTION = /<!subteam\^([A-Z0-9]+)/g;

export default function ThreadPingNotice(props: ComposerProps) {
  const groupIds = createMemo(() => {
    const ids = new Set<string>();
    for (const message of messages.messagesInThread(props.threadTs ?? "") ?? []) {
      for (const [, id] of message.text.matchAll(USERGROUP_MENTION)) if (id) ids.add(id);
    }
    return [...ids];
  });
  const names = createMemo(() =>
    groupIds().map((id) => {
      usergroups.ensureUsergroupDetails(id);
      return usergroups.usergroupById(id)?.name ?? "a group";
    }),
  );
  return (
    <Show when={props.threadTs && names().length}>
      <div class="thread-ping-notice">
        replying here pings <For each={names()}>{(name, i) => (i() ? `, ${name}` : name)}</For>
      </div>
    </Show>
  );
}
