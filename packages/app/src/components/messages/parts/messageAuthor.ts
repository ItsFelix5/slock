import { type Attachment, type Message, RELAY_BOT_ID } from "@slock/types";
import { DEFAULT_AVATAR_COLOR } from "@slock/ui";
import { store } from "../../../lib/store";

const USER_PROFILE_ID_RE = /^[UW]/;

const BOT_PROFILE_ID_RE = /^B/;

export function resolveBotProfileUserId(
  msg: Pick<Message, "botId" | "botName" | "userId">,
): string | undefined {
  if (BOT_PROFILE_ID_RE.test(msg.botId ?? "")) return msg.botId;
  if (msg.botName === "Slackbot") return "USLACKBOT";
  return msg.botName && (USER_PROFILE_ID_RE.test(msg.userId) || BOT_PROFILE_ID_RE.test(msg.userId))
    ? msg.userId
    : undefined;
}

export function resolveRelaySenderId(msg: Pick<Message, "botId" | "botName">): string | undefined {
  return msg.botId === RELAY_BOT_ID && msg.botName
    ? store.users.userIdByName(msg.botName)
    : undefined;
}

export function resolveProfileUserId(
  msg: Pick<Message, "botId" | "botName" | "userId">,
): string | undefined {
  if (USER_PROFILE_ID_RE.test(msg.userId)) return msg.userId;
  return resolveRelaySenderId(msg) ?? resolveBotProfileUserId(msg);
}

export function resolveLookupUserId(
  msg: Pick<Message, "botId" | "botName" | "userId">,
): string | undefined {
  return msg.botId && msg.botName ? undefined : resolveProfileUserId(msg);
}

export function isRealUserId(id: string | undefined): id is string {
  return !!id && USER_PROFILE_ID_RE.test(id);
}

export interface MessageAuthorFields {
  botIcon?: string;
  botId?: string;
  botName?: string;
  userId: string;
}

export function hasRealMessageAuthor(msg: MessageAuthorFields): boolean {
  return (!!msg.userId && msg.userId !== msg.botId) || !!resolveRelaySenderId(msg);
}

export function isBareLinkUnfurl(a: Attachment) {
  return (
    !!a.fromUrl &&
    !a.isMessageUnfurl &&
    !a.titleLink &&
    !a.text &&
    !a.pretext &&
    !a.imageUrl &&
    !a.videoUrl &&
    !a.footer &&
    !a.authorName &&
    !a.blocks?.length &&
    !a.fields?.length &&
    !a.files?.length &&
    !a.actions?.length
  );
}

export function resolveAttachmentAuthorName(
  attachment: Pick<Attachment, "authorId" | "authorName">,
  userById: (id: string) => { name: string } | undefined,
): string | undefined {
  return (
    (attachment.authorId ? userById(attachment.authorId)?.name : undefined) ?? attachment.authorName
  );
}

export function resolveAuthorDisplayName(
  msg: MessageAuthorFields,
  userName: string | undefined,
  fallback: string,
): string {
  return (
    (hasRealMessageAuthor(msg) ? (userName ?? msg.botName) : (msg.botName ?? userName)) ?? fallback
  );
}

export function unresolvedAuthorFallback(msg: Pick<MessageAuthorFields, "userId">): string {
  return msg.userId ? "Loading…" : "Someone";
}

export function resolveAuthorAvatarUrl(
  msg: MessageAuthorFields,
  userAvatarUrl: string | undefined,
): string | undefined {
  return hasRealMessageAuthor(msg)
    ? (userAvatarUrl ?? msg.botIcon)
    : (msg.botIcon ?? userAvatarUrl);
}

export interface MessageAuthorAvatarView {
  avatarColor: string;
  avatarUrl: string | undefined;
  id: string;
  name: string;
}

export function resolveMessageAuthorAvatar(
  msg: MessageAuthorFields,
  userById: (id: string) => { avatarColor?: string; avatarUrl?: string; name: string } | undefined,
): MessageAuthorAvatarView {
  const profileUserId = resolveProfileUserId(msg);
  const lookupUserId = resolveLookupUserId(msg);
  const user = hasRealMessageAuthor(msg) && lookupUserId ? userById(lookupUserId) : undefined;
  return {
    avatarColor: user?.avatarColor ?? DEFAULT_AVATAR_COLOR,
    avatarUrl: resolveAuthorAvatarUrl(msg, user?.avatarUrl),
    id: profileUserId ?? msg.userId,
    name: resolveAuthorDisplayName(msg, user?.name, "Unknown"),
  };
}
