import { defined, narrowByType } from "@slock/core";
import { service } from "@slock/core/solid";
import type { ComposerProps } from "@slock/plugins/composer/client/api";
import type { Block, RichTextBlock } from "@slock/types";

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

function collectUsergroupIds(elements: readonly unknown[], ids: Set<string>) {
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    if ("usergroup_id" in element && typeof element.usergroup_id === "string") {
      ids.add(element.usergroup_id);
    }
    if ("elements" in element && Array.isArray(element.elements)) {
      collectUsergroupIds(element.elements, ids);
    }
  }
}

const TEXT_USERGROUP_RE = /<!subteam\^([A-Z0-9]+)/g;

export function usergroupIdsOf(content: { blocks?: readonly Block[]; text?: string }): string[] {
  const ids = new Set<string>();
  for (const block of content.blocks ?? []) {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (richText) collectUsergroupIds(richText.elements, ids);
  }
  if (ids.size === 0) {
    for (const match of (content.text ?? "").matchAll(TEXT_USERGROUP_RE))
      ids.add(defined(match[1]));
  }
  return [...ids];
}
