// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to rendering.
import { Icon } from "@slock/ui";
import { For, type JSX, Show } from "solid-js";
import { useBlockKitResolver } from "./context";
import { formatSlackDateTokens } from "./dateFormat";
import EmojiText from "./emoji/EmojiText";
import { decodeTextEntities } from "./entities";
import { parseUserProfileLink } from "./userProfileLink";

// Slack mrkdwn -> node tree. Not a full-spec parser (Slack's real client has many edge
// cases around emphasis boundaries), but covers everything real workspaces actually send:
// bold/italic/strike/inline-code/code-fences, blockquotes, links, and the <@U..>/<#C..|n>/
// <!here>/<!date^..> special token syntax the server substitutes into message text.

type InlineNode =
  | { t: "text"; text: string }
  | { t: "bold"; nodes: InlineNode[] }
  | { t: "italic"; nodes: InlineNode[] }
  | { t: "strike"; nodes: InlineNode[] }
  | { t: "code"; text: string }
  | { t: "emoji"; name: string }
  | { t: "link"; url: string; label?: string }
  | { t: "userlink"; id: string; label?: string; url: string }
  | { t: "user"; id: string }
  | { t: "channel"; id: string; label?: string }
  | { t: "usergroup"; id: string; label?: string }
  | { t: "broadcast"; range: string }
  | {
      t: "date";
      timestamp: number;
      format: string;
      url?: string;
      fallback?: string;
    };

type BlockNode =
  | { t: "lines"; nodes: InlineNode[] }
  | { t: "quote"; nodes: InlineNode[] }
  | { t: "codeblock"; text: string };

// Emoji shortcode is matched as one atomic token, ahead of bold/italic, so
// the underscores inside names like :slightly_smiling_face: never get eaten
// by the italic rule (`_..._`) and leave the shortcode half-italicized/broken.
const INLINE_RE =
  /`([^`]+)`|<([^<>]*)>|:([a-z0-9_+-]+):|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

function parseToken(token: string): InlineNode {
  if (token.startsWith("@")) {
    const [id] = token.slice(1).split("|");
    return { id, t: "user" };
  }
  if (token.startsWith("#")) {
    const [id, label] = token.slice(1).split("|");
    return { id, label, t: "channel" };
  }
  if (token.startsWith("!subteam^")) {
    const [id, label] = token.slice("!subteam^".length).split("|");
    return { id, label, t: "usergroup" };
  }
  if (token.startsWith("!date^")) {
    const [main, fallback] = token.slice("!date^".length).split("|");
    const [ts, format, url] = main.split("^");
    return { fallback, format, t: "date", timestamp: Number(ts), url };
  }
  if (token.startsWith("!")) {
    const range = token.slice(1);
    if (range === "here" || range === "channel" || range === "everyone")
      return { range, t: "broadcast" };
    return { t: "text", text: `<${token}>` };
  }
  const [url, label] = token.split("|");
  const userId = parseUserProfileLink(url);
  return userId ? { id: userId, label, t: "userlink", url } : { label, t: "link", url };
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex)
      nodes.push({
        t: "text",
        text: text.slice(lastIndex, index),
      });
    const [, code, token, emoji, doubleBold, bold, italic, strike] = match;
    if (code !== undefined) nodes.push({ t: "code", text: decodeTextEntities(code) });
    else if (token !== undefined) nodes.push(parseToken(token));
    else if (emoji !== undefined) nodes.push({ name: emoji, t: "emoji" });
    else if (doubleBold !== undefined || bold !== undefined)
      nodes.push({ nodes: parseInline(doubleBold ?? bold), t: "bold" });
    else if (italic !== undefined) nodes.push({ nodes: parseInline(italic), t: "italic" });
    else if (strike !== undefined) nodes.push({ nodes: parseInline(strike), t: "strike" });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", text: text.slice(lastIndex) });
  return nodes;
}

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

function parseMrkdwn(text: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex, index)));
    blocks.push({
      t: "codeblock",
      text: decodeTextEntities(match[1].replace(/^\n/, "").replace(/\n$/, "")),
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex)));
  return blocks;
}

function formatDate(node: Extract<InlineNode, { t: "date" }>): string {
  return formatSlackDateTokens(node.format, node.timestamp, node.fallback);
}

export function Link(props: { url: string; label?: string }) {
  const resolver = useBlockKitResolver();
  const url = () => decodeTextEntities(props.url);
  const anchor = (
    <a class="bk-link" href={url()} rel="noopener noreferrer" target="_blank">
      {props.label ? <EmojiText text={props.label} /> : url()}
    </a>
  );
  return resolver.wrapLink?.(url(), anchor) ?? anchor;
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
  // Only true once we've actually resolved the channel and know it's private
  // and we're not in it — never true while unresolved, so this can't flash.
  const isInaccessible = () => isPrivate() && channel()?.isMember !== true;

  const onClick = () => {
    if (isInaccessible()) return;
    if (isUser) resolver.onUserClick(props.id);
    else resolver.onChannelClick(props.id);
  };

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
      return <EmojiText text={n.text} />;
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
      return <code class="bk-inline-code">{n.text}</code>;
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
      return n.url ? <Link label={formatDate(n)} url={n.url} /> : formatDate(n);
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
