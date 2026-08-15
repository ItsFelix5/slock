import { Icon, Tooltip } from "@slock/ui";
import { For, type JSX, Show } from "solid-js";
import { useBlockKitResolver, useTimeAnchor } from "./context";
import { formatFullDate, formatFullDateTime, formatSlackDateTokens } from "./dateFormat";
import EmojiText from "./emoji/EmojiText";
import { decodeTextEntities } from "./entities";
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
  const stripped = () => stripTrackingParams(decodeTextEntities(props.url));
  const anchor = (
    <a
      class={`bk-link ${props.class ?? ""}`}
      data-link-url={stripped()}
      href={stripped()}
      rel="noopener noreferrer"
      target="_blank"
      {...props.data}
    >
      {props.children ?? (props.label ? <EmojiText text={props.label} /> : props.url)}
    </a>
  );
  return resolver.wrapLink?.(stripped(), anchor) ?? anchor;
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
    <Tooltip content={formatFullDateTime(props.timestamp)}>
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

export function TimeAwareText(props: { text: string }) {
  const anchor = useTimeAnchor();
  const segments = () => {
    if (!anchor) return;
    const mentions = findTimeMentions(props.text, anchor.ms, anchor.tz);
    return mentions.length > 0 ? splitTimeMentions(props.text, mentions) : undefined;
  };
  return (
    <Show fallback={<EmojiText text={props.text} />} when={segments()}>
      {(parts) => (
        <For each={parts()}>
          {(seg) =>
            seg.timestamp === undefined ? (
              <EmojiText text={seg.text} />
            ) : (
              <Tooltip
                class="bk-time-mention-anchor"
                content={
                  seg.dateOnly
                    ? formatFullDate(seg.timestamp / 1000)
                    : formatFullDateTime(seg.timestamp / 1000)
                }
              >
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

export function Mention(props: { id: string; kind: "user" | "channel"; label?: string }) {
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

  const onClick = () => {
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
      onClick={() => resolver.onUsergroupClick(props.id)}
      type="button"
    >
      {name()}
    </button>
  );
  return resolver.wrapUsergroupMention?.(props.id, trigger) ?? trigger;
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

export default function Mrkdwn(props: { text: string }): JSX.Element {
  const blocks = () => parseMrkdwn(props.text ?? "");
  return (
    <For each={blocks()}>
      {(b) => (
        <Show
          fallback={
            <Show
              fallback={
                <pre class="bk-codeblock">{(b as Extract<BlockNode, { t: "codeblock" }>).text}</pre>
              }
              when={b.t === "quote"}
            >
              <blockquote class="bk-quote">
                <InlineList nodes={(b as Extract<BlockNode, { t: "quote" }>).nodes} />
              </blockquote>
            </Show>
          }
          when={b.t === "lines"}
        >
          <InlineList nodes={(b as Extract<BlockNode, { t: "lines" }>).nodes} />
        </Show>
      )}
    </For>
  );
}
