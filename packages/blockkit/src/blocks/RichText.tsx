import type {
  RichTextBlock as RichTextBlockType,
  RichTextInlineElement,
  RichTextSection,
  RichTextSubBlock,
} from "@slock/slack-api";
import { For, type JSX, Show } from "solid-js";
import { formatSlackDateTokens } from "../dateFormat";
import EmojiText from "../emoji/EmojiText";
import { hexCodepointsToEmoji } from "../emoji/emoji";
import { Link, Mention, UsergroupMention } from "../mrkdwn";
import { parseUserProfileLink } from "../userProfileLink";

function RichTextLeaf(props: { el: RichTextInlineElement }) {
  // biome-ignore lint/style/useDestructuring: Reading the Solid prop preserves its reactive getter.
  const el = props.el;
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
          <EmojiText text={el.text} />
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
      return <Mention id={el.user_id} kind="user" />;
    case "channel":
      return <Mention id={el.channel_id} kind="channel" />;
    case "usergroup":
      return <UsergroupMention id={el.usergroup_id} />;
    case "broadcast":
      return <span class="bk-mention bk-mention-broadcast">@{el.range}</span>;
    case "color":
      return (
        <span class="bk-color-swatch">
          <span class="bk-color-dot" style={{ background: el.value }} />
          {el.value}
        </span>
      );
    case "date":
      return el.url ? (
        <Link label={formatSlackDateTokens(el.format, el.timestamp, el.fallback)} url={el.url} />
      ) : (
        formatSlackDateTokens(el.format, el.timestamp, el.fallback)
      );
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

export default function RichText(props: { block: RichTextBlockType; trailing?: JSX.Element }) {
  return (
    <div class="bk-rich-text">
      <For each={props.block.elements}>
        {(sub: RichTextSubBlock, index) => {
          switch (sub.type) {
            case "rich_text_section":
              return (
                <RichTextSectionView
                  section={sub}
                  trailing={
                    index() === props.block.elements.length - 1 ? props.trailing : undefined
                  }
                />
              );
            case "rich_text_quote":
              return (
                <blockquote class="bk-quote">
                  <RichTextInline elements={sub.elements} />
                </blockquote>
              );
            case "rich_text_preformatted":
              return (
                <pre class="bk-codeblock">
                  <RichTextInline elements={sub.elements} />
                </pre>
              );
            case "rich_text_list":
              return (
                <Show
                  fallback={
                    <ul
                      class="bk-rt-list"
                      style={{
                        "padding-left": `${16 + (sub.indent ?? 0) * 20}px`,
                      }}
                    >
                      <For each={sub.elements}>
                        {(item) => (
                          <li>
                            <RichTextInline elements={item.elements} />
                          </li>
                        )}
                      </For>
                    </ul>
                  }
                  when={sub.style === "ordered"}
                >
                  <ol
                    class="bk-rt-list"
                    style={{
                      "padding-left": `${16 + (sub.indent ?? 0) * 20}px`,
                    }}
                  >
                    <For each={sub.elements}>
                      {(item) => (
                        <li>
                          <RichTextInline elements={item.elements} />
                        </li>
                      )}
                    </For>
                  </ol>
                </Show>
              );
            default:
              return null;
          }
        }}
      </For>
    </div>
  );
}
