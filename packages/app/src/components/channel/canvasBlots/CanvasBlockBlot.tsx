import type { CanvasBlock } from "@slock/types";
import Quill from "quill";
import { BlockEmbed } from "quill/blots/block";
import { render } from "solid-js/web";
import { CanvasBlockView } from "../CanvasContent";

const disposers = new WeakMap<Node, () => void>();

export interface CanvasBlockValue {
  block: CanvasBlock;
  id: string;
}

export class CanvasBlockBlot extends BlockEmbed {
  static blotName = "canvasBlock";
  static tagName = "div";
  static className = "canvas-readonly-block";

  static create(value: CanvasBlockValue) {
    // biome-ignore lint/complexity/noThisInStatic: parent embed class is resolved at runtime
    const node = super.create(value);
    if (!(node instanceof HTMLElement))
      throw new Error("canvasBlock blot produced a non-element node");
    node.contentEditable = "false";
    node.dataset.id = value.id;
    node.dataset.block = JSON.stringify(value.block);
    disposers.set(
      node,
      render(() => <CanvasBlockView block={value.block} index={-1} />, node),
    );
    return node;
  }

  static value(node: HTMLElement): CanvasBlockValue | undefined {
    const { block, id } = node.dataset;
    return block && id ? { block: JSON.parse(block), id } : undefined;
  }

  detach() {
    disposers.get(this.domNode)?.();
    super.detach();
  }
}

Quill.register(CanvasBlockBlot);
