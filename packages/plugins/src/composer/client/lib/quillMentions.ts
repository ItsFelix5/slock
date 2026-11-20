import { messageLinkLabel, parseArchiveLink, parseUserProfileLink } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { isChannelId } from "@slock/slack";
import { iconElement } from "@slock/ui";
import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import "./dateEmbed";
import "./emojiEmbed";
import { isMentionKind, MENTION_PREFIX, type MentionValue } from "./embedValues";

const titles = service("titles");
const usersStore = service("users");
const channelsStore = service("channels");

const usergroups = service("usergroups");

export function stripLeadingAt(name: string): string {
  return name.startsWith("@") ? name.slice(1) : name;
}

function isVisibleChannel(id: string): boolean {
  if (!isChannelId(id)) return false;
  const channel = channelsStore.channelById(id);
  return !!channel && (!channel.private || channelsStore.isChannelMember(id));
}

function mentionClassName(value: MentionValue, isSelf: boolean): string {
  switch (value.kind) {
    case "special":
      return "bk-mention bk-mention-broadcast";
    case "channel":
      return "bk-mention bk-mention-channel";
    case "userlink":
      return "bk-mention bk-mention-link";
    case "messagelink": {
      const channelId = parseArchiveLink(value.id)?.channelId;
      const visible = channelId !== undefined && isVisibleChannel(channelId);
      return `bk-mention bk-mention-link bk-mention-message${visible ? " bk-mention-visible" : ""}`;
    }
    default:
      return isSelf ? "bk-mention bk-mention-self" : "bk-mention";
  }
}

function mentionIcon(value: MentionValue): HTMLElement | undefined {
  if (value.kind === "messagelink") return iconElement("message", 12);
  if (
    value.kind === "channel" &&
    isChannelId(value.id) &&
    channelsStore.channelById(value.id)?.private
  )
    return iconElement("lock", 12);
}

export function mentionLabel(value: MentionValue): (HTMLElement | string)[] {
  const icon = mentionIcon(value);
  return [...(icon ? [icon] : []), `${icon ? "" : MENTION_PREFIX[value.kind]}${value.name}`];
}

class MentionBlot extends getEmbedBlot() {
  static blotName = "mention";
  static className = "bk-mention";
  static tagName = "span";

  static create(value: MentionValue) {
    const node = asElement(super.create(value), "mention");
    const isSelf =
      (value.kind === "user" && value.id === usersStore.currentUser()?.id) ||
      (value.kind === "usergroup" && usergroups.isSelfMember(value.id));
    node.className = mentionClassName(value, isSelf);
    node.dataset.kind = value.kind;
    node.dataset.id = value.id;
    node.dataset.name = value.name;
    node.replaceChildren(...mentionLabel(value));
    return node;
  }

  static value(node: HTMLElement): MentionValue | undefined {
    const { kind, id, name } = node.dataset;
    return isMentionKind(kind) ? { id: id ?? "", kind, name: name ?? "" } : undefined;
  }
}

Quill.register(MentionBlot);

export function linkMentionValue(
  url: string,
  label: string,
  authorId?: string,
): MentionValue | undefined {
  const userId = parseUserProfileLink(url);
  if (userId) return { id: userId, kind: "userlink", name: stripLeadingAt(label) };
  const archive = parseArchiveLink(url);
  if (!archive) return;
  if (!archive.isMessage) {
    return { id: archive.channelId, kind: "channel", name: titles.title(archive.channelId) };
  }
  if (label !== url) return;
  const authorName = authorId ? usersStore.userById(authorId)?.name : undefined;
  return {
    id: url,
    kind: "messagelink",
    name: messageLinkLabel(titles.label(archive.channelId), authorName),
  };
}
