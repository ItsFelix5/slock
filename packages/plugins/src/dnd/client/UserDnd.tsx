import { CLOCK_24H } from "@slock/core";
import { Errored, Loading, Show } from "solid-js";
import type { ProfileMetaProps } from "../../profile/client/api";
import { userDnd } from "./queries";

export default function UserDnd(props: ProfileMetaProps) {
  const until = userDnd.use(() => (props.user.isBot ? undefined : props.user.id));
  return (
    <Errored fallback={null}>
      <Loading>
        <Show when={until()}>
          {(paused) => (
            <p class="user-profile-meta text-muted text-sm">
              Notifications paused until {new Date(paused()).toLocaleTimeString([], CLOCK_24H)}
            </p>
          )}
        </Show>
      </Loading>
    </Errored>
  );
}
