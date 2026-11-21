import { service } from "@slock/core/solid";
import type { ComposerProps } from "@slock/plugins/composer/client/api";
import { usergroupIdsOf } from "@slock/slack";
import { createEffect, createMemo, For, Show } from "solid-js";
import "./ThreadPingNotice.css";

const messages = service("messages");
const usergroups = service("usergroups");

export default function ThreadPingNotice(props: ComposerProps) {
  const groupIds = createMemo(() => {
    const ids = new Set<string>();
    const { threadTs } = props;
    for (const message of (threadTs && messages.messagesInThread(threadTs)) || []) {
      for (const id of usergroupIdsOf(message)) ids.add(id);
    }
    return [...ids];
  });
  createEffect(groupIds, (ids) => {
    for (const id of ids) usergroups.ensureUsergroupDetails(id);
  });
  const names = createMemo(() =>
    groupIds().map((id) => usergroups.usergroupById(id)?.name ?? "a group"),
  );
  return (
    <Show when={props.threadTs && names().length}>
      <div class="thread-ping-notice">
        replying here pings <For each={names()}>{(name, i) => (i() ? `, ${name}` : name)}</For>
      </div>
    </Show>
  );
}
