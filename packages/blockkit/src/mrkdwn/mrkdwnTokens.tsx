import { formatTimeFromMs } from "@slock/core";
import { service } from "@slock/core/solid";
import "./mrkdwnTokens.css";
import { decodeTextEntities } from "@slock/slack";
import type { ChannelId, FileId, UserId } from "@slock/types";
import { Icon, Tooltip } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { For, Show } from "solid-js";
import {
  useBlockKitResolver,
  useHighlightWords,
  useInertTokens,
  useMessageAttachments,
  useTimeAnchor,
} from "../context";
import { formatHoverDateTime, formatSlackDateTokens } from "../dateFormat";
import EmojiText from "../emoji/EmojiText";
import { splitHighlightWords } from "../highlightWords";
import InlineAction from "../InlineAction";
import { HTTP_URL_RE, safeUrl } from "../safeUrl";
import { stripTrackingParams } from "../urlCleanup";
import { messageLinkLabel, parseArchiveLink, parseUserProfileLink } from "./mrkdwnInline";
import { findTimeMentions, splitTimeMentions } from "./textTimeMentions";

const env = service("env");
const LEADING_AT_RE = /^@/;

export function Link(props: {
  children?: JSX.Element;
  class?: string;
  url: string;
  label?: string;

  data?: Record<string, string>;
}) {
  const resolver = useBlockKitResolver();
  const attachments = useMessageAttachments();
  const inert = useInertTokens();
  const href = () => safeUrl(stripTrackingParams(decodeTextEntities(props.url)));
  const content = () =>
    props.children ?? (props.label ? <EmojiText text={props.label} /> : props.url);
  return (
    <Show
      fallback={
        <span class={`bk-link ${props.class ?? ""}`} {...props.data}>
          {content()}
        </span>
      }
      when={inert ? undefined : href()}
    >
      {(url) => {
        const anchor = (
          <a
            class={`bk-link ${props.class ?? ""}`}
            data-link-url={url()}
            href={url()}
            onClick={(e) => e.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
            {...props.data}
          >
            {content()}
          </a>
        );
        return resolver.wrapLink?.(url(), anchor, attachments()) ?? anchor;
      }}
    </Show>
  );
}

export function MessageLinkMention(props: {
  url: string;
  channelId: ChannelId;
  authorId?: UserId;
}) {
  const resolver = useBlockKitResolver();
  const attachments = useMessageAttachments();
  const unfurl = () => attachments()?.find((a) => a.fromUrl === props.url);
  const authorName = () => {
    const authorId = props.authorId ?? unfurl()?.authorId;
    return (authorId && resolver.resolveUser(authorId)?.name) || unfurl()?.authorName;
  };
  const label = () => {
    const channel = resolver.resolveChannel(props.channelId);
    return messageLinkLabel(channel?.label ?? props.channelId, authorName());
  };
  const channel = () => resolver.resolveChannel(props.channelId);
  const isVisible = () => !!channel() && (!channel()?.isPrivate || channel()?.isMember === true);
  return (
    <Link
      class={`bk-mention bk-mention-link bk-mention-message${isVisible() ? " bk-mention-visible" : ""}`}
      data={{ "data-copy": props.url }}
      url={props.url}
    >
      <Icon name="message" size={12} />
      {label()}
    </Link>
  );
}

export function LinkToken(props: { url: string; label?: string }) {
  const label = props.label && !HTTP_URL_RE.test(props.label) ? props.label : undefined;
  const userId = parseUserProfileLink(props.url);
  if (userId)
    return (
      <Mention id={userId} kind="user" label={label?.replace(LEADING_AT_RE, "")} url={props.url} />
    );
  const archive = parseArchiveLink(props.url);
  if (archive && !archive.isMessage)
    return <Mention id={archive.channelId} kind="channel" label={label} url={props.url} />;
  if (!archive || label) return <Link label={props.label} url={props.url} />;
  return <MessageLinkMention channelId={archive.channelId} url={props.url} />;
}

export function DateToken(props: {
  fallback?: string;
  format: string;
  timestamp: number;
  url?: string;
}) {
  const label = formatSlackDateTokens(props.format, props.timestamp, env.now(), props.fallback);
  const dateData = () => ({
    "data-date-fallback": props.fallback ?? "",
    "data-date-format": props.format,
    "data-date-ts": String(props.timestamp),
  });
  return (
    <Tooltip content={formatHoverDateTime(props.timestamp, env.now())}>
      {props.url ? (
        <Link class="bk-date" data={dateData()} url={props.url}>
          {label}
        </Link>
      ) : (
        <span class="bk-date" {...dateData()}>
          {label}
        </span>
      )}
    </Tooltip>
  );
}

function HighlightedText(props: { text: string }) {
  const highlightWords = useHighlightWords();
  const segments = () => splitHighlightWords(props.text, highlightWords());
  return (
    <For each={segments()}>
      {(seg) =>
        seg.highlighted ? (
          <mark class="bk-highlight-word">
            <EmojiText text={seg.text} />
          </mark>
        ) : (
          <EmojiText text={seg.text} />
        )
      }
    </For>
  );
}

export function TimeAwareText(props: { text: string }) {
  const anchor = useTimeAnchor();
  const segments = () => {
    if (!anchor) return;
    const mentions = findTimeMentions(props.text, anchor.ms, anchor.tz);
    return mentions.length > 0 ? splitTimeMentions(props.text, mentions) : undefined;
  };
  return (
    <Show fallback={<HighlightedText text={props.text} />} when={segments()}>
      {(parts) => (
        <For each={parts()}>
          {(seg) =>
            seg.timestamp === undefined ? (
              <HighlightedText text={seg.text} />
            ) : (
              <Tooltip class="bk-time-mention-anchor" content={formatTimeFromMs(seg.timestamp)}>
                <span class="bk-time-mention">
                  <EmojiText text={seg.text} />
                </span>
              </Tooltip>
            )
          }
        </For>
      )}
    </Show>
  );
}

export function Mention(
  props: {
    label?: string;
    bold?: boolean;
    url?: string;
  } & ({ id: UserId; kind: "user" } | { id: ChannelId; kind: "channel" }),
) {
  const resolver = useBlockKitResolver();
  const isUser = props.kind === "user";
  const user = () => (props.kind === "user" ? resolver.resolveUser(props.id) : undefined);
  const channel = () => (props.kind === "channel" ? resolver.resolveChannel(props.id) : undefined);
  const name = () => decodeTextEntities((user() ?? channel())?.name ?? props.label ?? props.id);
  const isPrivate = () => !isUser && channel()?.isPrivate === true;

  const isInaccessible = () =>
    !isUser && (isPrivate() ? channel()?.isMember !== true : !(channel() || props.label));

  const onClick = (e: Event) => {
    e.stopPropagation();
    if (isInaccessible()) return;
    if (props.kind === "user") resolver.onUserClick(props.id);
    else resolver.onChannelClick(props.id);
  };

  const mentionData = () =>
    isUser
      ? { "data-link-url": props.url, "data-mention-id": props.id }
      : {
          "data-channel-id": props.id,
          "data-copy": `#${name()}`,
          "data-channel-name": name(),
          "data-link-url": props.url,
        };

  const trigger = (
    <InlineAction
      class={[
        "bk-mention",
        {
          "bk-mention-bold": !!props.bold,
          "bk-mention-channel": !isUser,
          "bk-mention-inaccessible": isInaccessible(),
          "bk-mention-link": isUser && props.label !== undefined,
          "bk-mention-self": isUser && !!user()?.isSelf,
        },
      ]}
      disabled={isInaccessible()}
      onActivate={onClick}
      {...mentionData()}
    >
      <Show fallback={isUser ? "@" : "#"} when={isPrivate()}>
        <Icon name="lock" size={12} />
      </Show>
      {name()}
    </InlineAction>
  );

  return props.kind === "user"
    ? (resolver.wrapUserMention?.(props.id, trigger) ?? trigger)
    : (resolver.wrapChannelMention?.(props.id, trigger) ?? trigger);
}

export function UsergroupMention(props: { id: string; label?: string }) {
  const resolver = useBlockKitResolver();
  const info = () => resolver.resolveUsergroup(props.id);
  const name = () => decodeTextEntities(props.label ?? info()?.name ?? `@${props.id}`);
  const trigger = (
    <InlineAction
      class={["bk-mention", { "bk-mention-self": !!info()?.isSelf }]}
      data-usergroup-id={props.id}
      onActivate={(e) => {
        e.stopPropagation();
        resolver.onUsergroupClick(props.id);
      }}
    >
      {name()}
    </InlineAction>
  );
  return resolver.wrapUsergroupMention?.(props.id, trigger) ?? trigger;
}

export function CanvasMention(props: { fileId: FileId; label?: string }) {
  const resolver = useBlockKitResolver();
  const title = () => props.label || resolver.resolveCanvasTitle(props.fileId);
  const onClick = (e: Event) => {
    e.stopPropagation();
    resolver.onCanvasClick(props.fileId, title());
  };
  return (
    <InlineAction class="bk-canvas" onActivate={onClick}>
      <Icon name="canvas-content" size={12} />
      <EmojiText text={title() ?? "canvas"} />
    </InlineAction>
  );
}
