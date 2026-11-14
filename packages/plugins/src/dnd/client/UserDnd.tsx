import { CLOCK_24H } from "@slock/core";
import { Show } from "solid-js";
import type { ProfileMetaProps } from "../../profile/client/api";
import { createKeyedQuery, defineKey } from "../../query/client/api";
import { fetchUserDnd, USER_DND_QUERY } from "./fetch";

const userDndKey = defineKey<[string]>(USER_DND_QUERY);

export default function UserDnd(props: ProfileMetaProps) {
  const dnd = createKeyedQuery(() => {
    const { id, isBot } = props.user;
    if (isBot) return;
    return { queryFn: () => fetchUserDnd(id), queryKey: userDndKey(id) };
  });
  return (
    <Show when={dnd.data}>
      {(until) => (
        <p class="user-profile-meta text-muted text-sm">
          Notifications paused until {new Date(until()).toLocaleTimeString([], CLOCK_24H)}
        </p>
      )}
    </Show>
  );
}
