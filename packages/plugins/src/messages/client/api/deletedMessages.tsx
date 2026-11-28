import { getHost } from "@slock/core/solid";
import { isHiddenSubtype } from "@slock/slack";
import type { Message } from "@slock/types";
import { type Component, Show } from "solid-js";

export const retainsDeleted = (msg: Message) =>
  !isHiddenSubtype(msg.subtype) &&
  getHost()
    .items("messages.retain")
    .some((retain) => retain(msg));

export function liveOnly<P extends { msg: Message }>(Inner: Component<P>): Component<P> {
  return (props) => (
    <Show when={!props.msg.deleted}>
      <Inner {...props} />
    </Show>
  );
}
