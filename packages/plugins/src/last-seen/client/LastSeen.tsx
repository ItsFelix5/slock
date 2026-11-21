import { formatLastSeen } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { ProfileMetaProps } from "@slock/plugins/profile/client/api";
import { defineQuery } from "@slock/plugins/query/client/api";
import { apiGet } from "@slock/slack";
import type { UserId } from "@slock/types";
import { createClock } from "@slock/ui";
import { createMemo, Show } from "solid-js";

const messages = service("messages");

const CLOCK_MS = 60_000;

async function fetchLastSeen(userId: UserId): Promise<number | null> {
  const data = await apiGet<{ lastSeen: number | null }>(`/api/users/${userId}/last-seen`);
  if (!data.ok) throw new Error(data.error ?? "last seen lookup failed");
  return data.lastSeen;
}

const lastSeen = defineQuery<UserId, number | null>({ load: fetchLastSeen, name: "lastSeen" });

export default function LastSeen(props: ProfileMetaProps) {
  const now = createClock(CLOCK_MS);
  const seen = lastSeen.state(() => (props.user.isBot ? undefined : props.user.id));
  const text = createMemo(() => {
    if (props.user.isBot || props.user.presence === "active") return;
    const seenAt = Math.max(seen().data ?? 0, messages.latestMessageTsMsByUser(props.user.id) ?? 0);
    return seenAt ? formatLastSeen(seenAt, now()) : undefined;
  });
  return (
    <Show when={text()}>
      <p class="user-profile-meta text-muted text-sm">Last seen {text()}</p>
    </Show>
  );
}
