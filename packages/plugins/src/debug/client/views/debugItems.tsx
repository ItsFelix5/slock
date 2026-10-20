import { service } from "@slock/core/solid";
import { IconButton, MenuItem, showDebugInfo } from "@slock/ui";
import type { ActivityMenuProps } from "../../../activity/client/api";
import type { ChannelMenuProps, MessageMenuProps } from "../../../messages/client/api";
import type { ProfileMetaProps } from "../../../profile/client/api";

const usersStore = service("users");
const channels = service("channels");
const dms = service("dms");

const userName = (id: string) => usersStore.userById(id)?.name ?? id;

function DebugItem(props: { close(): void; title: string; data: unknown }) {
  return (
    <MenuItem
      icon="bug"
      onClick={() => {
        props.close();
        showDebugInfo(props.title, props.data);
      }}
    >
      Show debug info
    </MenuItem>
  );
}

export function MessageDebugItem(props: MessageMenuProps) {
  const msg = () => props.msg;
  return (
    <DebugItem
      close={props.close}
      data={{
        author: usersStore.userById(msg().userId),
        channel: channels.channelById(props.channelId) ?? dms.dmById(props.channelId),
        message: msg(),
        reactions: msg().reactions?.map((reaction) => ({
          ...reaction,
          users: reaction.users.map(userName),
        })),
        replyUsers: msg().replyUsers?.map(userName),
        threadTs: props.threadTs,
      }}
      title={`Message ${msg().ts}`}
    />
  );
}

export function ActivityDebugItem(props: ActivityMenuProps) {
  return (
    <DebugItem close={props.close} data={props.row} title={`Activity row: ${props.row.key}`} />
  );
}

export function ChannelDebugItem(props: ChannelMenuProps) {
  return (
    <DebugItem
      close={props.close}
      data={props.isDm ? dms.dmById(props.channelId) : channels.channelById(props.channelId)}
      title={`${props.isDm ? "DM" : "Channel"} ${props.channelId}`}
    />
  );
}

export function ProfileDebugButton(props: ProfileMetaProps) {
  return (
    <IconButton
      icon="bug"
      iconSize={15}
      label="User debug"
      onClick={() => showDebugInfo(`User ${props.user.id}`, props.user)}
      size="sm"
    />
  );
}
