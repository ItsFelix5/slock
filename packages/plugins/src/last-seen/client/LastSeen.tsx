import { formatLastSeen } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { apiGet } from "@slock/slack";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import type { ProfileMetaProps } from "../../profile/client/api";
import { createKeyedQuery, defineKey } from "../../query/client/api";

const lastSeenKey = defineKey<[string]>("lastSeen");

const messages = service("messages");

const CLOCK_MS = 60_000;

async function fetchLastSeen(userId: string): Promise<number | null> {
  const data = await apiGet<{ lastSeen: number | null }>(`/api/last-seen/${userId}`);
  if (!data.ok) throw new Error(data.error ?? "last seen lookup failed");
  return data.lastSeen;
}

export default function LastSeen(props: ProfileMetaProps) {
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
  onCleanup(() => clearInterval(timer));
  const seen = createKeyedQuery(() => {
    const { id, isBot } = props.user;
    if (isBot) return;
    return { queryFn: () => fetchLastSeen(id), queryKey: lastSeenKey(id) };
  });
  const text = createMemo(() => {
    if (props.user.isBot || props.user.presence === "active") return;
    const seenAt = Math.max(seen.data ?? 0, messages.latestMessageTsMsByUser(props.user.id) ?? 0);
    return seenAt ? formatLastSeen(seenAt, now()) : undefined;
  });
  return (
    <Show when={text()}>
      <p class="user-profile-meta text-muted text-sm">Last seen {text()}</p>
    </Show>
  );
}
