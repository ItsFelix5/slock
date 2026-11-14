import { isRichTextSubBlock } from "@slock/slack";
import type {
  RichTextBlock as RichTextBlockType,
  RichTextInlineElement,
  RichTextList as RichTextListType,
  RichTextSection,
  RichTextStyle,
  RichTextSubBlock,
} from "@slock/types";
import { For, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import EmojiText from "../emoji/EmojiText";
import { hexCodepointsToEmoji } from "../emoji/emoji";
import { parseArchiveLink } from "../mrkdwnInline";
import {
  CanvasMention,
  DateToken,
  Link,
  LinkToken,
  Mention,
  MessageLinkMention,
  TimeAwareText,
  UsergroupMention,
} from "../mrkdwnTokens";
import { safeColor } from "../safeColor";
import "./RichText.css";
import "../mrkdwn.css";
import "../mrkdwnTokens.css";

function styleClasses(style: RichTextStyle | undefined) {
  return {
    "bk-rt-bold": !!style?.bold,
    "bk-inline-code": !!style?.code,
    "bk-rt-highlight": !!style?.highlight,
    "bk-rt-italic": !!style?.italic,
    "bk-rt-strike": !!style?.strike,
  };
}

function RichTextLeaf(props: { el: RichTextInlineElement }) {
  const { el } = props;
  switch (el.type) {
    case "text":
      return (
        <span class="bk-rt-text" classList={styleClasses(el.style)}>
          <TimeAwareText text={el.text} />
        </span>
      );
    case "link": {
      const link = <LinkToken label={el.text} url={el.url} />;
      return el.style ? <span classList={styleClasses(el.style)}>{link}</span> : link;
    }
    case "emoji": {
      const unicode = el.unicode && hexCodepointsToEmoji(el.unicode);
      return unicode ? (
        <span class="emoji" data-emoji-name={el.name}>
          {unicode}
        </span>
      ) : (
        <EmojiText text={`:${el.name}:`} />
      );
    }
    case "user":
      return el.user_id ? <Mention bold={el.style?.bold} id={el.user_id} kind="user" /> : null;
    case "channel":
      return el.channel_id ? (
        <Mention bold={el.style?.bold} id={el.channel_id} kind="channel" />
      ) : null;
    case "usergroup":
      return el.usergroup_id ? <UsergroupMention id={el.usergroup_id} /> : null;
    case "broadcast":
      return (
        <span class="bk-mention bk-mention-broadcast" data-broadcast={el.range.split("|")[0]}>
          @{el.range.split("|")[0]}
        </span>
      );
    case "color":
      return (
        <span class="bk-color-swatch">
          <span class="bk-color-dot" style={{ background: safeColor(el.value) }} />
          {el.value}
        </span>
      );
    case "date":
      return (
        <DateToken
          fallback={el.fallback}
          format={el.format}
          timestamp={el.timestamp}
          url={el.url}
        />
      );
    case "message_mention": {
      const channelId = el.channel_id ?? parseArchiveLink(el.url)?.channelId;
      return channelId ? (
        <MessageLinkMention authorId={el.author_id} channelId={channelId} url={el.url} />
      ) : (
        <Link label={el.text} url={el.url} />
      );
    }
    case "canvas":
      return <CanvasMention fileId={el.file_id} label={el.text === el.url ? undefined : el.text} />;
    default:
      return null;
  }
}

function RichTextInline(props: { elements: RichTextInlineElement[] }) {
  return <For each={props.elements}>{(el) => <RichTextLeaf el={el} />}</For>;
}

function RichTextSectionView(props: { section: RichTextSection; trailing?: JSX.Element }) {
  return (
    <div class="bk-rt-section">
      <RichTextInline elements={props.section.elements} />
      {props.trailing}
    </div>
  );
}

const ORDERED_MARKERS = ["decimal", "lower-alpha", "lower-roman"];
const BULLET_MARKERS = ["disc", "circle", "square"];
const LIST_INDENT_PX = 28;

function RichTextListView(props: { list: RichTextListType }) {
  const ordered = () => props.list.style === "ordered";
  const indent = () => props.list.indent ?? 0;
  const markers = () => (ordered() ? ORDERED_MARKERS : BULLET_MARKERS);
  return (
    <Dynamic
      class="bk-rt-list"
      component={ordered() ? "ol" : "ul"}
      start={ordered() ? (props.list.offset ?? 0) + 1 : undefined}
      style={{
        "list-style-type": markers()[indent() % markers().length],
        "padding-left": `${(indent() + 1) * LIST_INDENT_PX}px`,
      }}
    >
      <For each={props.list.elements}>
        {(item) => (
          <li>
            <RichTextInline elements={item.elements} />
          </li>
        )}
      </For>
    </Dynamic>
  );
}

function SubBlockView(props: { sub: RichTextSubBlock }) {
  const { sub } = props;
  switch (sub.type) {
    case "rich_text_section":
      return <RichTextSectionView section={sub} />;
    case "rich_text_quote":
      return (
        <blockquote class="bk-quote quote-bar">
          <QuoteContent elements={sub.elements} />
        </blockquote>
      );
    case "rich_text_preformatted":
      return (
        <pre class="bk-codeblock">
          <RichTextInline elements={sub.elements} />
        </pre>
      );
    case "rich_text_list":
      return <RichTextListView list={sub} />;
    default:
      return null;
  }
}

function QuoteContent(props: { elements: (RichTextInlineElement | RichTextSubBlock)[] }) {
  const nodes: JSX.Element[] = [];
  let run: RichTextInlineElement[] = [];
  const flushRun = () => {
    if (run.length === 0) return;
    nodes.push(<RichTextInline elements={run} />);
    run = [];
  };
  for (const el of props.elements) {
    if (isRichTextSubBlock(el)) {
      flushRun();
      nodes.push(<SubBlockView sub={el} />);
    } else {
      run.push(el);
    }
  }
  flushRun();
  return <>{nodes}</>;
}

export default function RichText(props: { block: RichTextBlockType; trailing?: JSX.Element }) {
  return (
    <div class="bk-rich-text">
      <For each={props.block.elements}>
        {(sub: RichTextSubBlock, index) => {
          const isLastSection =
            sub.type === "rich_text_section" && index() === props.block.elements.length - 1;
          return isLastSection ? (
            <RichTextSectionView section={sub} trailing={props.trailing} />
          ) : (
            <SubBlockView sub={sub} />
          );
        }}
      </For>
    </div>
  );
}
