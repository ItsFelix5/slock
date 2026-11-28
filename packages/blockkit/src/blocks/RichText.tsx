import { logUnknown } from "@slock/core";
import {
  ifPresent,
  isChannelId,
  isFileId,
  isRichTextSubBlock,
  isUserId,
  messageMentionUrl,
  parseUserId,
} from "@slock/slack";
import { getCachedWorkspaceDomain } from "@slock/slack/client";
import type {
  RichTextBlock,
  RichTextHeader,
  RichTextInlineElement,
  RichTextList,
  RichTextMessageMentionElement,
  RichTextSection,
  RichTextStyle,
  RichTextSubBlock,
} from "@slock/types";
import type { JSX } from "@solidjs/web";
import { dynamic } from "@solidjs/web";
import { For } from "solid-js";
import EmojiText, { EmojiGlyph } from "../emoji/EmojiText";
import { hexCodepointsToEmoji } from "../emoji/emoji";
import {
  CanvasMention,
  DateToken,
  Link,
  LinkToken,
  Mention,
  MessageLinkMention,
  TimeAwareText,
  UsergroupMention,
} from "../mrkdwn/mrkdwnTokens";
import { safeColor } from "../safeColor";
import "@slock/ui/tag/tag.css";
import "./RichText.css";
import "../mrkdwn/mrkdwn.css";
import "../mrkdwn/mrkdwnTokens.css";

function styleClasses(style: RichTextStyle | undefined) {
  return {
    "bk-rt-bold": !!style?.bold,
    "bk-inline-code": !!style?.code,
    "bk-rt-highlight": !!(style?.highlight || style?.client_highlight),
    "bk-rt-italic": !!style?.italic,
    "bk-rt-strike": !!style?.strike,
    "bk-rt-underline": !!style?.underline,
  };
}

function MessageMentionView(props: { el: RichTextMessageMentionElement }) {
  const { el } = props;
  const url = messageMentionUrl(el, getCachedWorkspaceDomain());
  const mention = isChannelId(el.channel_id) ? (
    <MessageLinkMention
      authorId={ifPresent(parseUserId, el.author_id)}
      channelId={el.channel_id}
      url={url}
    />
  ) : (
    <Link label={el.text} url={url} />
  );
  return el.style ? <span class={styleClasses(el.style)}>{mention}</span> : mention;
}

function RichTextLeaf(props: { el: RichTextInlineElement }) {
  const { el } = props;
  switch (el.type) {
    case "text":
      return (
        <span class={["bk-rt-text", styleClasses(el.style)]}>
          <TimeAwareText text={el.text} />
        </span>
      );
    case "link": {
      const link = <LinkToken label={el.text} url={el.url} />;
      return el.style ? <span class={styleClasses(el.style)}>{link}</span> : link;
    }
    case "emoji": {
      const unicode = el.unicode && hexCodepointsToEmoji(el.unicode);
      return unicode ? (
        <EmojiGlyph glyph={unicode} name={el.name} />
      ) : (
        <EmojiText text={`:${el.name}:`} />
      );
    }
    case "user":
    case "canvas_user_mention":
      return isUserId(el.user_id) ? (
        <Mention bold={el.style?.bold} id={el.user_id} kind="user" />
      ) : null;
    case "channel":
      return isChannelId(el.channel_id) ? (
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
    case "tag":
      return (
        <span class={["bk-tag", `bk-tag-${el.color ?? "gray"}`, styleClasses(el.style)]}>
          {el.text}
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
    case "message_mention":
      return <MessageMentionView el={el} />;
    case "canvas":
      return isFileId(el.file_id) ? (
        <CanvasMention fileId={el.file_id} label={el.text === el.url ? undefined : el.text} />
      ) : null;
    case "canvas_message_unfurl":
      return (
        <MessageMentionView
          el={{
            channel_id: el.root_message_channel,
            message_ts: el.root_message_ts,
            style: el.style,
            type: "message_mention",
          }}
        />
      );
    case "attachment_mention":
    case "citation":
    case "work_object_mention":
      return <Link label={el.text} url={el.url} />;
    case "file":
    case "list_record":
    case "workflow_mention":
      return el.url ? <Link label={el.text} url={el.url} /> : el.text;
    case "team":
      return <span class="bk-mention">Workspace</span>;
    case "salesforce_data_field":
      return el.salesforce_field_label ?? "Salesforce field";
    default:
      logUnknown("rich text element", el satisfies never);
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

function RichTextHeaderView(props: { header: RichTextHeader }) {
  const Heading = dynamic(() => `h${props.header.level ?? 1}` as const);
  return (
    <Heading class="bk-header">
      <RichTextInline elements={props.header.elements} />
    </Heading>
  );
}

const ORDERED_MARKERS = ["decimal", "lower-alpha", "lower-roman"];
const BULLET_MARKERS = ["disc", "circle", "square"];
const LIST_INDENT_PX = 28;

function RichTextListView(props: { list: RichTextList }) {
  const ordered = () => props.list.style === "ordered";
  const indent = () => props.list.indent ?? 0;
  const markers = () => (ordered() ? ORDERED_MARKERS : BULLET_MARKERS);
  const List = dynamic(() => (ordered() ? "ol" : "ul"));
  return (
    <List
      class="bk-rt-list"
      data-indent={indent()}
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
    </List>
  );
}

function SubBlockView(props: { sub: RichTextSubBlock; trailing?: JSX.Element }) {
  const { sub } = props;
  switch (sub.type) {
    case "rich_text_section":
      return <RichTextSectionView section={sub} trailing={props.trailing} />;
    case "rich_text_header":
      return <RichTextHeaderView header={sub} />;
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
    case "rich_text_divider":
      return <hr class="bk-divider" />;
    case "rich_text_list":
      return <RichTextListView list={sub} />;
    default:
      logUnknown("rich text block", sub satisfies never);
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

export default function RichText(props: { block: RichTextBlock; trailing?: JSX.Element }) {
  return (
    <div class="bk-rich-text">
      <For each={props.block.elements}>
        {(sub: RichTextSubBlock, index) => (
          <SubBlockView
            sub={sub}
            trailing={index() === props.block.elements.length - 1 ? props.trailing : undefined}
          />
        )}
      </For>
    </div>
  );
}
