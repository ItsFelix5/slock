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
import DeltaClipboard from "./deltaClipboard";

Quill.register("modules/clipboard", DeltaClipboard, true);
Quill.register({
  "formats/blockquote": Blockquote,
  "formats/bold": Bold,
  "formats/code": Code,
  "formats/code-block": CodeBlock,
  "formats/header": Header,
  "formats/indent": Indent,
  "formats/italic": Italic,
  "formats/link": Link,
  "formats/list": List,
  "formats/strike": Strike,
  "formats/underline": Underline,
});

export {
  type AttributeMap,
  type Bounds,
  Delta,
  default,
  type Op,
  Parchment,
  type Range,
} from "quill/core";

export function getEmbedBlot(): typeof EmbedBlot {
  return EmbedBlot;
}
