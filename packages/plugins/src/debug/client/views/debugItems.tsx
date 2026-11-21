import type { ActivityMenuProps } from "@slock/plugins/activity/client/api";
import type { CanvasDocModel } from "@slock/plugins/canvas/client/api";
import type { ChannelMenuProps, MessageMenuProps } from "@slock/plugins/messages/client/api";
import type { ProfileMetaProps } from "@slock/plugins/profile/client/api";
import type { FileId } from "@slock/types";
import { IconButton, MenuItem } from "@slock/ui";
import { messageId, openDebug } from "../entities";

function DebugItem(props: { close(): void; entity: string; id: string }) {
  return (
    <MenuItem
      icon="bug"
      onClick={() => {
        props.close();
        openDebug(props.entity, props.id);
      }}
    >
      Show debug info
    </MenuItem>
  );
}

function DebugButton(props: { entity: string; id: string; label: string }) {
  return (
    <IconButton
      icon="bug"
      iconSize={15}
      label={props.label}
      onClick={() => openDebug(props.entity, props.id)}
      size="sm"
    />
  );
}

export const MessageDebugItem = (props: MessageMenuProps) => (
  <DebugItem close={props.close} entity="message" id={messageId(props.channelId, props.msg.ts)} />
);

export const ActivityDebugItem = (props: ActivityMenuProps) => (
  <DebugItem close={props.close} entity="activity" id={props.row.items[0]?.id ?? props.row.key} />
);

export const ChannelDebugItem = (props: ChannelMenuProps) => (
  <DebugItem close={props.close} entity="channel" id={props.channelId} />
);

export const ProfileDebugButton = (props: ProfileMetaProps) => (
  <DebugButton entity="user" id={props.user.id} label="User debug" />
);

export const CanvasDebugButton = (props: { doc: CanvasDocModel | null; fileId: FileId }) => (
  <DebugButton entity="canvas" id={props.fileId} label="Canvas debug" />
);
