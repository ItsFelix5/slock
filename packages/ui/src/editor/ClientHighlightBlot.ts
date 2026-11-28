import Inline from "quill/blots/inline";

export default class ClientHighlightBlot extends Inline {
  static override blotName = "client_highlight";
  static override tagName = "mark";
}
