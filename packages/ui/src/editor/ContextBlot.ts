import Quill from "quill";
import Block from "quill/blots/block";
import { bindLinePrefix } from "./blockShortcuts";

const CONTEXT_PREFIX = /^-#$/;

export default class ContextBlot extends Block {
  static blotName = "context";
  static tagName = "aside";

  static bindShortcut(editor: Quill) {
    bindLinePrefix(editor, {
      prefix: CONTEXT_PREFIX,
      length: 2,
      format: ContextBlot.blotName,
      value: true,
    });
  }
}

Quill.register(ContextBlot);
