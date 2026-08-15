import type {
  RichTextBlock as RichTextBlockType,
  RichTextInlineElement,
  RichTextList as RichTextListType,
  RichTextSection,
  RichTextSubBlock,
} from "@slock/slack-api";
import { For, type JSX, Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";
import { hexCodepointsToEmoji } from "../emoji/emoji";
import { DateToken, Link, Mention, TimeAwareText, UsergroupMention } from "../mrkdwn";
import { parseUserProfileLink } from "../userProfileLink";

function RichTextLeaf(props: { el: RichTextInlineElement }) {
  const { el } = props;
  switch (el.type) {
    case "text": {
      const s = el.style;
      return (
        <span
          class="bk-rt-text"
          classList={{
            "bk-rt-bold": !!s?.bold,
            "bk-rt-code": !!s?.code,
            "bk-rt-highlight": !!s?.highlight,
            "bk-rt-italic": !!s?.italic,
            "bk-rt-strike": !!s?.strike,
          }}
        >
          <TimeAwareText text={el.text} />
        </span>
      );
    }
    case "link": {
      const userId = parseUserProfileLink(el.url);
      return userId ? (
        <Mention id={userId} kind="user" label={el.text} />
      ) : (
        <Link label={el.text} url={el.url} />
      );
    }
    case "emoji": {
      const unicode = el.unicode && hexCodepointsToEmoji(el.unicode);
      return unicode ? <span class="emoji">{unicode}</span> : <EmojiText text={`:${el.name}:`} />;
    }
    case "user":
      return el.user_id ? <Mention id={el.user_id} kind="user" /> : null;
    case "channel":
      return el.channel_id ? <Mention id={el.channel_id} kind="channel" /> : null;
    case "usergroup":
      return el.usergroup_id ? <UsergroupMention id={el.usergroup_id} /> : null;
    case "broadcast":
      return <span class="bk-mention bk-mention-broadcast">@{el.range.split("|")[0]}</span>;
    case "color":
      return (
        <span class="bk-color-swatch">
          <span class="bk-color-dot" style={{ background: el.value }} />
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
    case "message_mention":
      return <Link label={el.text} url={el.url} />;
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

function RichTextListView(props: { list: RichTextListType }) {
  return (
    <Show
      fallback={
        <ul
          class="bk-rt-list"
          style={{ "padding-left": `${16 + (props.list.indent ?? 0) * 20}px` }}
        >
          <For each={props.list.elements}>
            {(item) => (
              <li>
                <RichTextInline elements={item.elements} />
              </li>
            )}
          </For>
        </ul>
      }
      when={props.list.style === "ordered"}
    >
      <ol class="bk-rt-list" style={{ "padding-left": `${16 + (props.list.indent ?? 0) * 20}px` }}>
        <For each={props.list.elements}>
          {(item) => (
            <li>
              <RichTextInline elements={item.elements} />
            </li>
          )}
        </For>
      </ol>
    </Show>
  );
}

const SUB_BLOCK_TYPES = new Set<RichTextSubBlock["type"]>([
  "rich_text_section",
  "rich_text_list",
  "rich_text_preformatted",
  "rich_text_quote",
]);

function SubBlockView(props: { sub: RichTextSubBlock }) {
  const { sub } = props;
  switch (sub.type) {
    case "rich_text_section":
      return <RichTextSectionView section={sub} />;
    case "rich_text_quote":
      return (
        <blockquote class="bk-quote">
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
    if (SUB_BLOCK_TYPES.has(el.type as RichTextSubBlock["type"])) {
      flushRun();
      nodes.push(<SubBlockView sub={el as RichTextSubBlock} />);
    } else {
      run.push(el as RichTextInlineElement);
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
