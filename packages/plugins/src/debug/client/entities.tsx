import { service } from "@slock/core/solid";
import { Avatar, Icon } from "@slock/ui";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { openConversation } from "../../conversations/client/api/nav";
import { loadCanvasDebug } from "./canvasDebugData";

const users = service("users");
const channels = service("channels");
const dms = service("dms");
const usergroups = service("usergroups");
const usergroupDetails = service("usergroup-details");
const messages = service("messages");
const messageLinks = service("message-links");
const canvas = service("canvas");
const activity = service("activity");
const panes = service("shell.panes");

type Ref = { entity: string; id: string };

export type Entity = {
  label: string;
  title(id: string): string;
  load(id: string): unknown;
  open(id: string): void;
  related?(id: string): Ref[];
  pattern?: RegExp;
  wrap?: "wrapUserMention" | "wrapChannelMention" | "wrapUsergroupMention";
  chip?(id: string): JSX.Element;
};

const MESSAGE_SEPARATOR = ":";

export const messageId = (channelId: string, ts: string) => `${channelId}${MESSAGE_SEPARATOR}${ts}`;

function splitMessageId(id: string) {
  const split = id.indexOf(MESSAGE_SEPARATOR);
  return { channelId: id.slice(0, split), ts: id.slice(split + 1) };
}

export const entities: Record<string, Entity> = {
  activity: {
    label: "Activity",
    load: (id) => activity.activityItems.find((item) => item.id === id),
    open: (id) => {
      const item = activity.activityItems.find((candidate) => candidate.id === id);
      if (item) messageLinks.openChannelMessage(item.channelId, item.ts, item.threadTs);
    },
    title: (id) => `Activity ${id}`,
  },
  canvas: {
    label: "Canvas",
    load: loadCanvasDebug,
    open: (id) => canvas.openCanvasPane(id),
    title: (id) => `Canvas ${id}`,
  },
  channel: {
    chip: (id) =>
      dms.dmById(id) ? (
        <Icon name="direct-messages" size={12} />
      ) : channels.channelById(id)?.private ? (
        <Icon name="lock" size={12} />
      ) : (
        <span>#</span>
      ),
    label: "Channel",
    load: (id) => channels.channelById(id) ?? dms.dmById(id),
    open: openConversation,
    pattern: /^[CGD][A-Z0-9]{8,}$/,
    title: (id) => `${dms.dmById(id) ? "DM" : "Channel"} ${id}`,
    wrap: "wrapChannelMention",
  },
  message: {
    label: "Message",
    load: (id) => {
      const { channelId, ts } = splitMessageId(id);
      return messages.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
    },
    open: (id) => {
      const { channelId, ts } = splitMessageId(id);
      messageLinks.openChannelMessage(channelId, ts);
    },
    related: (id) => [{ entity: "channel", id: splitMessageId(id).channelId }],
    title: (id) => `Message ${splitMessageId(id).ts}`,
  },
  user: {
    chip: (id) => (
      <Show when={users.userById(id)}>{(user) => <Avatar size="tiny" user={user()} />}</Show>
    ),
    label: "Profile",
    load: (id) => users.userById(id),
    open: (id) => users.openUserProfile(id),
    pattern: /^[UWB][A-Z0-9]{8,}$/,
    title: (id) => `User ${id}`,
    wrap: "wrapUserMention",
  },
  usergroup: {
    chip: () => <Icon name="user-groups" size={12} />,
    label: "Pinggroup",
    load: (id) => {
      const usergroup = usergroups.usergroupById(id);
      return usergroup && { details: usergroups.usergroupDetailsById(id), usergroup };
    },
    open: (id) => usergroupDetails.openUsergroupDetails(id),
    pattern: /^S[A-Z0-9]{8,}$/,
    title: (id) => `Pinggroup ${id}`,
    wrap: "wrapUsergroupMention",
  },
};

export function openDebug(entity: string, id: string) {
  panes.openInNewPane({ entity, id, kind: "debug" });
}
