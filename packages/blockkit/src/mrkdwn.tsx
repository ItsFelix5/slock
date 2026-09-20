import { Icon, Tooltip } from "@slock/ui";
import { createMemo, For, type JSX, Show } from "solid-js";
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
import { type InlineNode, parseInline } from "./mrkdwnInline";
import "./mrkdwnTime.css";
import { findTimeMentions, splitTimeMentions } from "./textTimeMentions";
import { stripTrackingParams } from "./urlCleanup";

type BlockNode =
  | { t: "lines"; nodes: InlineNode[] }
  | { t: "quote"; nodes: InlineNode[] }
  | { t: "codeblock"; text: string };

const QUOTE_LINE_RE = /^&gt;\s?/;

function parseLinesAndQuotes(text: string): BlockNode[] {
  const lines = text.split("\n");
  const groups: BlockNode[] = [];
  let current: string[] = [];
  let currentIsQuote = false;

  const flush = () => {
    if (current.length === 0) return;
    const joined = current.join("\n");
    groups.push({
      nodes: parseInline(joined),
      t: currentIsQuote ? "quote" : "lines",
    });
    current = [];
  };

  for (const line of lines) {
    const isQuote = QUOTE_LINE_RE.test(line);
    if (isQuote !== currentIsQuote) flush();
    currentIsQuote = isQuote;
    current.push(isQuote ? line.replace(QUOTE_LINE_RE, "") : line);
  }
  flush();
  return groups;
}

const CODE_FENCE_RE = /```([\s\S]*?)```/g;
const CODE_FENCE_LEADING_NEWLINE_RE = /^\n/;
const CODE_FENCE_TRAILING_NEWLINE_RE = /\n$/;

function parseMrkdwn(text: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex, index)));
    blocks.push({
      t: "codeblock",
      text: decodeTextEntities(
        match[1]
          .replace(CODE_FENCE_LEADING_NEWLINE_RE, "")
          .replace(CODE_FENCE_TRAILING_NEWLINE_RE, ""),
      ),
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex)));
  return blocks;
}

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
  const isPrivate = () => !isUser && channel()?.isPrivate !== false;

  const isInaccessible = () => isPrivate() && channel()?.isMember !== true;

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
  const label = () => props.label || "canvas";
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    resolver.onCanvasClick(props.fileId, label());
  };
  return (
    <button class="bk-canvas" onClick={onClick} type="button">
      <Icon name="canvas-content" size={14} />
      <EmojiText text={label()} />
    </button>
  );
}

function InlineNodeView(props: { node: InlineNode }) {
  const n = props.node;
  switch (n.t) {
    case "text":
      return <TimeAwareText text={n.text} />;
    case "bold":
      return (
        <strong>
          <InlineList nodes={n.nodes} />
        </strong>
      );
    case "italic":
      return (
        <em>
          <InlineList nodes={n.nodes} />
        </em>
      );
    case "strike":
      return (
        <s>
          <InlineList nodes={n.nodes} />
        </s>
      );
    case "code":
      return (
        <code class="bk-inline-code">
          <InlineList nodes={n.nodes} />
        </code>
      );
    case "emoji":
      return <EmojiText text={`:${n.name}:`} />;
    case "link":
      return <Link label={n.label} url={n.url} />;
    case "userlink":
      return <Mention id={n.id} kind="user" label={n.label} />;
    case "user":
      return <Mention id={n.id} kind="user" />;
    case "channel":
      return <Mention id={n.id} kind="channel" label={n.label} />;
    case "usergroup":
      return <UsergroupMention id={n.id} label={n.label} />;
    case "canvas":
      return <CanvasMention fileId={n.fileId} label={n.label} />;
    case "broadcast":
      return <span class="bk-mention bk-mention-broadcast">@{n.range}</span>;
    case "date":
      return (
        <DateToken fallback={n.fallback} format={n.format} timestamp={n.timestamp} url={n.url} />
      );
  }
}

function InlineList(props: { nodes: InlineNode[] }) {
  return <For each={props.nodes}>{(n) => <InlineNodeView node={n} />}</For>;
}

function renderBlock(b: BlockNode, inline: boolean | undefined) {
  switch (b.t) {
    case "lines":
      return <InlineList nodes={b.nodes} />;
    case "quote":
      if (inline) return <InlineList nodes={b.nodes} />;
      return (
        <blockquote class="bk-quote">
          <InlineList nodes={b.nodes} />
        </blockquote>
      );
    case "codeblock":
      if (inline) return <code class="bk-inline-code">{b.text}</code>;
      return <pre class="bk-codeblock">{b.text}</pre>;
  }
}

export default function Mrkdwn(props: { inline?: boolean; text: string }): JSX.Element {
  const text = createMemo(() => props.text ?? "");
  const blocks = createMemo(() => parseMrkdwn(text()));
  return <For each={blocks()}>{(b) => renderBlock(b, props.inline)}</For>;
}
