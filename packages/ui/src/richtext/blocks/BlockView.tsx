import type { Block } from "../docModel";
import type { EditorHandle } from "../editorHandle";
import type { AtomRenderers } from "../RunView";
import CodeBlockView from "./CodeBlockView";
import ContextBlockView from "./ContextBlockView";
import DividerBlockView from "./DividerBlockView";
import HeadingBlockView from "./HeadingBlockView";
import ListBlockView from "./ListBlockView";
import ParagraphBlockView from "./ParagraphBlockView";
import QuoteBlockView from "./QuoteBlockView";
import TableBlockView from "./TableBlockView";

/** Dispatches a single block to its view by kind — the one place that switch lives, shared by
 * `EditorView`'s top-level `<For>` and `QuoteBlockView`'s recursive rendering of its children. */
export default function BlockView<A>(props: {
  block: Block<A>;
  blockPath: number[];
  atomRenderers: AtomRenderers;
  editor: EditorHandle<A>;
  placeholder?: string;
}) {
  const block = props.block;
  if (block.kind === "paragraph") {
    return (
      <ParagraphBlockView
        atomRenderers={props.atomRenderers}
        block={block}
        blockPath={props.blockPath}
        editor={props.editor}
        placeholder={props.placeholder}
      />
    );
  }
  if (block.kind === "heading") {
    return (
      <HeadingBlockView
        atomRenderers={props.atomRenderers}
        block={block}
        blockPath={props.blockPath}
        editor={props.editor}
      />
    );
  }
  if (block.kind === "context") {
    return (
      <ContextBlockView
        atomRenderers={props.atomRenderers}
        block={block}
        blockPath={props.blockPath}
        editor={props.editor}
      />
    );
  }
  if (block.kind === "divider") {
    return <DividerBlockView blockPath={props.blockPath} />;
  }
  if (block.kind === "codeblock") {
    return <CodeBlockView block={block} blockPath={props.blockPath} />;
  }
  if (block.kind === "quote") {
    return (
      <QuoteBlockView
        atomRenderers={props.atomRenderers}
        block={block}
        blockPath={props.blockPath}
        editor={props.editor}
      />
    );
  }
  if (block.kind === "list") {
    return (
      <ListBlockView
        atomRenderers={props.atomRenderers}
        block={block}
        blockPath={props.blockPath}
        editor={props.editor}
      />
    );
  }
  if (block.kind === "table") {
    return (
      <TableBlockView
        atomRenderers={props.atomRenderers}
        block={block}
        blockPath={props.blockPath}
        editor={props.editor}
      />
    );
  }
  return null;
}
