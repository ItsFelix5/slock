import { createMemo, For, type JSX } from "solid-js";
import EmojiText from "./emoji/EmojiText";
import { decodeTextEntities } from "./entities";
import { type InlineNode, parseInline } from "./mrkdwnInline";
import {
  CanvasMention,
  DateToken,
  LinkToken,
  Mention,
  TimeAwareText,
  UsergroupMention,
} from "./mrkdwnTokens";
import "./mrkdwn.css";

type BlockNode =
  | { t: "lines"; nodes: InlineNode[] }
  | { t: "quote"; nodes: InlineNode[] }
  | { t: "codeblock"; text: string };

const QUOTE_LINE_RE = /^&gt;\s?/;

export const HTTP_URL_RE = /^https?:\/\//;

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

function stripSurroundingNewline(text: string): string {
  const start = text.startsWith("\n") ? 1 : 0;
  const end = text.endsWith("\n") ? -1 : text.length;
  return text.slice(start, end);
}

function parseMrkdwn(text: string): BlockNode[] {
  const blocks: BlockNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex, index)));
    blocks.push({
      t: "codeblock",
      text: decodeTextEntities(stripSurroundingNewline(match[1])),
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) blocks.push(...parseLinesAndQuotes(text.slice(lastIndex)));
  return blocks;
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
      return <LinkToken label={n.label} url={n.url} />;
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
        <blockquote class="bk-quote quote-bar">
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
