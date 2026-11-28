import EmbedBlot from "quill/blots/embed";
import Quill from "quill/core";
import Blockquote from "quill/formats/blockquote";
import Bold from "quill/formats/bold";
import CodeBlock, { Code } from "quill/formats/code";
import Header from "quill/formats/header";
import Indent from "quill/formats/indent";
import Italic from "quill/formats/italic";
import Link from "quill/formats/link";
import List from "quill/formats/list";
import Strike from "quill/formats/strike";
import Underline from "quill/formats/underline";
import ClientHighlightBlot from "./ClientHighlightBlot";
import DeltaClipboard, { type PasteFilter } from "./deltaClipboard";
import TagBlot from "./TagBlot";

Quill.register("modules/clipboard", DeltaClipboard, true);
Quill.register({
  "formats/blockquote": Blockquote,
  "formats/bold": Bold,
  "formats/client_highlight": ClientHighlightBlot,
  "formats/code": Code,
  "formats/code-block": CodeBlock,
  "formats/header": Header,
  "formats/indent": Indent,
  "formats/italic": Italic,
  "formats/link": Link,
  "formats/list": List,
  "formats/strike": Strike,
  "formats/tag": TagBlot,
  "formats/underline": Underline,
});

export { Delta, default, type Op, Parchment, type Range } from "quill/core";
export { DELTA_CLIPBOARD_TYPE } from "./deltaClipboard";

export function filterPastes(quill: Quill, filter: PasteFilter) {
  if (quill.clipboard instanceof DeltaClipboard) quill.clipboard.filter = filter;
}

export function getEmbedBlot(): typeof EmbedBlot {
  return EmbedBlot;
}
