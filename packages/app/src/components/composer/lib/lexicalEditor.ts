import { $createCodeNode, $isCodeNode, CodeNode } from "@lexical/code";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { $createLinkNode, $isLinkNode, LinkNode } from "@lexical/link";
import {
  $createListItemNode,
  $createListNode,
  $isListNode,
  ListItemNode,
  ListNode,
  registerList,
} from "@lexical/list";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
  registerRichText,
} from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  createEditor,
  type ElementNode,
  FORMAT_TEXT_COMMAND,
  type LexicalNode,
  type TextFormatType,
} from "lexical";

type Mark = "bold" | "italic" | "strike" | "code";
type Block = "heading" | "quote" | "code" | "bullet" | "number";

function formatText(text: string, format: TextFormatType, parent: ElementNode) {
  const node = $createTextNode(text);
  node.setFormat(format);
  parent.append(node);
}

function appendInline(parent: ElementNode, source: string) {
  const token = /<([^<>]+)>|(`[^`]+`|\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
  let offset = 0;
  for (const match of source.matchAll(token)) {
    const index = match.index ?? 0;
    if (index > offset) parent.append($createTextNode(source.slice(offset, index)));
    const [value] = match;
    if (value.startsWith("<")) {
      const [url, label] = value.slice(1, -1).split("|");
      if (/^https?:\/\//.test(url)) {
        const link = $createLinkNode(url);
        link.append($createTextNode(label ?? url));
        parent.append(link);
      } else {
        parent.append($createTextNode(value));
      }
    } else {
      const [marker] = value;
      formatText(
        value.slice(1, -1),
        marker === "*"
          ? "bold"
          : marker === "_"
            ? "italic"
            : marker === "~"
              ? "strikethrough"
              : "code",
        parent,
      );
    }
    offset = index + value.length;
  }
  if (offset < source.length) parent.append($createTextNode(source.slice(offset)));
}

function loadMrkdwn(value: string) {
  const root = $getRoot();
  root.clear();
  const lines = value.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "```") {
      const source: string[] = [];
      while (lines[index + 1] !== undefined && lines[index + 1] !== "```")
        source.push(lines[++index]);
      if (lines[index + 1] === "```") index++;
      root.append($createCodeNode().append($createTextNode(source.join("\n"))));
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const node = $createHeadingNode(
        `h${heading[1].length}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
      );
      appendInline(node, heading[2]);
      root.append(node);
      continue;
    }
    if (line === "---") {
      root.append($createParagraphNode().append($createTextNode(line)));
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      const node = $createQuoteNode();
      appendInline(node, quote[1]);
      root.append(node);
      continue;
    }
    const list = /^(?:•|[-*])\s+(.*)$/.exec(line);
    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    if (list || ordered) {
      const node = $createListNode(ordered ? "number" : "bullet");
      const item = $createListItemNode();
      appendInline(item, (list ?? ordered)?.[1] ?? "");
      node.append(item);
      root.append(node);
      continue;
    }
    const paragraph = $createParagraphNode();
    appendInline(paragraph, line);
    root.append(paragraph);
  }
  if (!root.getChildrenSize()) root.append($createParagraphNode());
}

function serializeInline(node: LexicalNode): string {
  if ($isTextNode(node)) {
    const text = node.getTextContent();
    if (node.hasFormat("bold")) return `*${text}*`;
    if (node.hasFormat("italic")) return `_${text}_`;
    if (node.hasFormat("strikethrough")) return `~${text}~`;
    if (node.hasFormat("code")) return `\`${text}\``;
    return text;
  }
  if ($isLinkNode(node)) return `<${node.getURL()}|${node.getTextContent()}>`;
  return $isElementNode(node) ? node.getChildren().map(serializeInline).join("") : "";
}

function serializeNode(node: LexicalNode): string {
  const inner = serializeInline(node);
  if ($isHeadingNode(node)) return `${"#".repeat(Number(node.getTag()[1]))} ${inner}`;
  if ($isQuoteNode(node)) return `> ${inner}`;
  if ($isCodeNode(node)) return `\`\`\`\n${inner}\n\`\`\``;
  if ($isListNode(node)) {
    return node
      .getChildren()
      .map(
        (item, index) =>
          `${node.getListType() === "number" ? `${index + 1}.` : "•"} ${serializeInline(item)}`,
      )
      .join("\n");
  }
  return inner;
}

export function createLexicalEditor(opts: { setText: (value: string) => void }) {
  const editor = createEditor({
    namespace: "slock-composer",
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode],
    onError: (error) => {
      throw error;
    },
    theme: {
      code: "composer-pre",
      heading: {
        h1: "composer-header",
        h2: "composer-header",
        h3: "composer-header",
        h4: "composer-header",
        h5: "composer-header",
        h6: "composer-header",
      },
      list: {
        listitem: "",
        nested: { listitem: "" },
        ol: "composer-list",
        ul: "composer-list",
      },
      quote: "composer-quote",
      text: { bold: "", code: "", italic: "", strikethrough: "" },
    },
  });
  let root: HTMLDivElement | undefined;
  let value = "";
  const unregister = [
    registerRichText(editor),
    registerList(editor),
    registerHistory(editor, createEmptyHistoryState(), 300),
  ];
  editor.registerUpdateListener(({ editorState }) => {
    value = editorState.read(() => $getRoot().getChildren().map(serializeNode).join("\n"));
    opts.setText(value);
  });

  function setRef(next: HTMLDivElement) {
    root = next;
    if (!next.ownerDocument.defaultView) return;
    editor.setRootElement(next);
    editor.update(() => loadMrkdwn(value));
  }

  function loadDraftIntoEditor(nextValue: string) {
    value = nextValue;
    editor.update(() => loadMrkdwn(nextValue));
  }

  function getTextContext() {
    return editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!($isRangeSelection(selection) && selection.isCollapsed())) return null;
      const node = selection.anchor.getNode();
      return $isTextNode(node)
        ? { offset: selection.anchor.offset, text: node.getTextContent() }
        : null;
    });
  }

  function replaceTrigger(start: number, text: string) {
    editor.update(() => {
      const selection = $getSelection();
      if (!($isRangeSelection(selection) && selection.isCollapsed())) return;
      const node = selection.anchor.getNode();
      if (!$isTextNode(node)) return;
      const before = node.getTextContent().slice(0, start);
      const after = node.getTextContent().slice(selection.anchor.offset);
      node.setTextContent(`${before}${text}${after}`);
      node.select(start + text.length, start + text.length);
    });
  }

  function insertText(text: string) {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) selection.insertText(text);
    });
  }

  function applyBlock(block: Block) {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const current = selection.anchor.getNode().getTopLevelElementOrThrow();
      const children = current.getChildren();
      if (block === "bullet" || block === "number") {
        const list = $createListNode(block === "bullet" ? "bullet" : "number");
        list.append($createListItemNode().append(...children));
        current.replace(list);
        list.selectEnd();
        return;
      }
      const replacement =
        block === "heading"
          ? $createHeadingNode("h3")
          : block === "quote"
            ? $createQuoteNode()
            : $createCodeNode();
      replacement.append(...children);
      current.replace(replacement);
      replacement.selectEnd();
    });
  }

  return {
    applyMark: (mark: Mark) =>
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, mark === "strike" ? "strikethrough" : mark),
    applyBlock,
    clearEditor: () => loadDraftIntoEditor(""),
    destroy: () => {
      unregister.forEach((dispose) => {
        dispose();
      });
    },
    focusEditor: () => root?.focus(),
    getRef: () => root,
    getTextContext,
    insertDateChipAtCaret: (timestamp: number, format = "{date_num} {time}") =>
      insertText(`<!date^${timestamp}^${format}|${timestamp}> `),
    loadDraftIntoEditor,
    replaceTrigger,
    restoreSelection: () => root?.focus(),
    saveSelection: () => {},
    setRef,
    syncFromDom: () => {},
  };
}
