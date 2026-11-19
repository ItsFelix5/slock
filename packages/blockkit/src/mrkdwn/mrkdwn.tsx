import { createMemo, For, type JSX } from "solid-js";
import { InertTokensContext } from "../context";
import EmojiText from "../emoji/EmojiText";
import { type BlockNode, parseMrkdwn } from "./mrkdwnBlocks";
import type { InlineNode } from "./mrkdwnInline";
import {
  CanvasMention,
  DateToken,
  LinkToken,
  Mention,
  TimeAwareText,
  UsergroupMention,
} from "./mrkdwnTokens";
import "./mrkdwn.css";

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
      return (
        <span class="bk-mention bk-mention-broadcast" data-broadcast={n.range}>
          @{n.range}
        </span>
      );
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
  const blocks = createMemo(() => parseMrkdwn(props.text ?? ""));
  return (
    <InertTokensContext.Provider value={!!props.inline}>
      <For each={blocks()}>{(b) => renderBlock(b, props.inline)}</For>
    </InertTokensContext.Provider>
  );
}
