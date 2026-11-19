import { service } from "@slock/core/solid";
import { Show } from "solid-js";
import type { ActivityMenuProps } from "../../../activity/client/api";
import type { MessageMenuProps } from "../../../messages/client/api";
import RemindMenu from "./RemindMenu";

const activityStore = service("activity");

export function MessageRemindItem(props: MessageMenuProps) {
  return <RemindMenu channelId={props.channelId} close={props.close} ts={props.msg.ts} />;
}

export function ActivityRemindItem(props: ActivityMenuProps) {
  const latest = () => props.row.items[0];
  const markReminderRead = () => {
    if (latest()?.activityType === "saved_reminder")
      activityStore.markActivityItemsRead(props.row.items);
  };
  return (
    <Show when={latest()}>
      {(item) => (
        <RemindMenu
          channelId={item().channelId}
          close={props.close}
          onRemind={markReminderRead}
          ts={item().threadTs ?? item().ts}
        />
      )}
    </Show>
  );
}
