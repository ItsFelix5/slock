import "./mrkdwnTokens.css";
import { Icon, Tooltip } from "@slock/ui";
import { For, type JSX, Show } from "solid-js";
import {
  useBlockKitResolver,
  useHighlightWords,
  useMessageAttachments,
  useTimeAnchor,
} from "./context";
import { formatHoverDateTime, formatSlackDateTokens, formatTime } from "./dateFormat";
import EmojiText from "./emoji/EmojiText";
import { decodeTextEntities } from "./entities";
import { splitHighlightWords } from "./highlightWords";
import { HTTP_URL_RE } from "./mrkdwn";
import { messageLinkLabel, parseArchiveLink, parseUserProfileLink } from "./mrkdwnInline";
import { findTimeMentions, splitTimeMentions } from "./textTimeMentions";
import { stripTrackingParams } from "./urlCleanup";

export function Link(props: {
  children?: JSX.Element;
  class?: string;
  url: string;
  label?: string;

  data?: Record<string, string>;
}) {
  const resolver = useBlockKitResolver();
  const attachments = useMessageAttachments();
  const stripped = () => stripTrackingParams(decodeTextEntities(props.url));
  const anchor = (
    <a
      class={`bk-link ${props.class ?? ""}`}
      data-link-url={stripped()}
      href={stripped()}
      onClick={(e) => e.stopPropagation()}
      rel="noopener noreferrer"
      target="_blank"
      {...props.data}
    >
      {props.children ?? (props.label ? <EmojiText text={props.label} /> : props.url)}
    </a>
  );
  return resolver.wrapLink?.(stripped(), anchor, attachments()) ?? anchor;
}

export function MessageLinkMention(props: { url: string; channelId: string; authorId?: string }) {
  const resolver = useBlockKitResolver();
  const label = () =>
    messageLinkLabel(
      resolver.resolveChannel(props.channelId)?.name ?? props.channelId,
      props.authorId ? resolver.resolveUser(props.authorId)?.name : undefined,
    );
  const channel = () => resolver.resolveChannel(props.channelId);
  const isVisible = () => !!channel() && (!channel()?.isPrivate || channel()?.isMember === true);
  return (
    <Link
      class={`bk-mention bk-mention-link bk-mention-message${isVisible() ? " bk-mention-visible" : ""}`}
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
  if (userId) return <Mention id={userId} kind="user" label={label} />;
  const archive = parseArchiveLink(props.url);
  if (archive && !archive.isMessage)
    return <Mention id={archive.channelId} kind="channel" label={label} />;
  if (!archive || label) return <Link label={props.label} url={props.url} />;
  return <MessageLinkMention channelId={archive.channelId} url={props.url} />;
}

export function DateToken(props: {
  fallback?: string;
  format: string;
  timestamp: number;
  url?: string;
}) {
  const label = formatSlackDateTokens(props.format, props.timestamp, props.fallback);
  const dateData = () => ({
    "data-date-fallback": props.fallback ?? "",
    "data-date-format": props.format,
    "data-date-ts": String(props.timestamp),
  });
  return (
    <Tooltip content={formatHoverDateTime(props.timestamp)}>
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
              <Tooltip class="bk-time-mention-anchor" content={formatTime(seg.timestamp)}>
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

export function Mention(props: {
  id: string;
  kind: "user" | "channel";
  label?: string;
  bold?: boolean;
}) {
  const resolver = useBlockKitResolver();
  const isUser = props.kind === "user";
  const user = () => (isUser ? resolver.resolveUser(props.id) : undefined);
  const channel = () => (isUser ? undefined : resolver.resolveChannel(props.id));
  const name = () =>
    decodeTextEntities(
      isUser
        ? (user()?.name ?? props.label ?? props.id)
        : (channel()?.name ?? props.label ?? props.id),
    );
  const isPrivate = () => !isUser && channel()?.isPrivate === true;

  const isInaccessible = () =>
    !isUser && (isPrivate() ? channel()?.isMember !== true : !(channel() || props.label));

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (isInaccessible()) return;
    if (isUser) resolver.onUserClick(props.id);
    else resolver.onChannelClick(props.id);
  };

  const mentionData = () =>
    isUser
      ? { "data-mention-id": props.id }
      : { "data-channel-id": props.id, "data-channel-name": name() };

  const trigger = (
    <button
      class="bk-mention"
      classList={{
        "bk-mention-bold": !!props.bold,
        "bk-mention-channel": !isUser,
        "bk-mention-inaccessible": isInaccessible(),
        "bk-mention-link": isUser && props.label !== undefined,
        "bk-mention-self": isUser && !!user()?.isSelf,
      }}
      onClick={onClick}
      type="button"
      {...mentionData()}
    >
      <Show fallback={isUser ? "@" : "#"} when={isPrivate()}>
        <Icon name="lock" size={12} />
      </Show>
      {name()}
    </button>
  );

  return isUser
    ? (resolver.wrapUserMention?.(props.id, trigger) ?? trigger)
    : (resolver.wrapChannelMention?.(props.id, trigger) ?? trigger);
}

export function UsergroupMention(props: { id: string; label?: string }) {
  const resolver = useBlockKitResolver();
  const info = () => resolver.resolveUsergroup(props.id);
  const name = () => decodeTextEntities(props.label ?? info()?.name ?? `@${props.id}`);
  const trigger = (
    <button
      class="bk-mention"
      classList={{ "bk-mention-self": !!info()?.isSelf }}
      onClick={(e) => {
        e.stopPropagation();
        resolver.onUsergroupClick(props.id);
      }}
      type="button"
    >
      {name()}
    </button>
  );
  return resolver.wrapUsergroupMention?.(props.id, trigger) ?? trigger;
}

export function CanvasMention(props: { fileId: string; label?: string }) {
  const resolver = useBlockKitResolver();
  const title = () => props.label || resolver.resolveCanvasTitle(props.fileId);
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    resolver.onCanvasClick(props.fileId, title());
  };
  return (
    <button class="bk-canvas" onClick={onClick} type="button">
      <Icon name="canvas-content" size={14} />
      <EmojiText text={title() ?? "canvas"} />
    </button>
  );
}
