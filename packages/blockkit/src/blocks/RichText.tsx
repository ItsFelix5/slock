import type {
  RichTextBlock as RichTextBlockType,
  RichTextInlineElement,
  RichTextSection,
  RichTextSubBlock,
} from "@slock/slack-api";
import { For, Show } from "solid-js";
import EmojiText from "../emoji/EmojiText";
import { formatSlackDate, Mention } from "../mrkdwn";

function RichTextLeaf(props: { el: RichTextInlineElement }) {
  const el = props.el;
  switch (el.type) {
    case "text": {
      const s = el.style;
      return (
        <span
          class="bk-rt-text"
          classList={{
            "bk-rt-bold": !!s?.bold,
            "bk-rt-italic": !!s?.italic,
            "bk-rt-strike": !!s?.strike,
            "bk-rt-code": !!s?.code,
            "bk-rt-highlight": !!s?.highlight,
          }}
        >
          <EmojiText text={el.text} />
        </span>
      );
    }
    case "link":
      return (
        <a class="bk-link" href={el.url} target="_blank" rel="noopener noreferrer">
          {el.text ? <EmojiText text={el.text} /> : el.url}
        </a>
      );
    case "emoji":
      return el.unicode ? (
        <span class="emoji">{el.unicode}</span>
      ) : (
        <EmojiText text={`:${el.name}:`} />
      );
    case "user":
      return <Mention id={el.user_id} kind="user" />;
    case "channel":
      return <Mention id={el.channel_id} kind="channel" />;
    case "usergroup":
      return <span class="bk-mention bk-mention-static">@{el.usergroup_id}</span>;
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
        <a class="bk-link" href={el.url} target="_blank" rel="noopener noreferrer">
          {formatSlackDate(el.timestamp, el.fallback)}
        </a>
      ) : (
        formatSlackDate(el.timestamp, el.fallback)
      );
    default:
      return null;
  }
}

function RichTextInline(props: { elements: RichTextInlineElement[] }) {
  return <For each={props.elements}>{(el) => <RichTextLeaf el={el} />}</For>;
}

function RichTextSectionView(props: { section: RichTextSection }) {
  return (
    <div class="bk-rt-section">
      <RichTextInline elements={props.section.elements} />
    </div>
  );
}

export default function RichText(props: { block: RichTextBlockType }) {
  return (
    <div class="bk-rich-text">
      <For each={props.block.elements}>
        {(sub: RichTextSubBlock) => {
          switch (sub.type) {
            case "rich_text_section":
              return <RichTextSectionView section={sub} />;
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
                  when={sub.style === "ordered"}
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
