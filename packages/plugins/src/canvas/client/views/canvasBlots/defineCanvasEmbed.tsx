import Quill from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import type { JSX } from "@solidjs/web";
import { render } from "@solidjs/web";
import { BlockEmbed } from "quill/blots/block";

export interface EmbedViewProps<Value> {
  bind(read: () => Value): void;
  node: HTMLElement;
  value: Value;
}

interface EmbedState<Value> {
  dispose: () => void;
  read: () => Value;
}

export function defineCanvasEmbed<Value>(config: {
  className: string;
  name: string;
  view: (props: EmbedViewProps<Value>) => JSX.Element;
}) {
  const states = new WeakMap<Node, EmbedState<Value>>();

  class CanvasEmbedBlot extends BlockEmbed {
    static override blotName = config.name;
    static override tagName = "div";
    static override className = config.className;

    static override create(value: Value) {
      const node = asElement(super.create(value), config.name);
      node.contentEditable = "false";
      const state: EmbedState<Value> = { dispose: () => undefined, read: () => value };
      states.set(node, state);
      state.dispose = render(
        () =>
          config.view({
            bind: (read) => {
              state.read = read;
            },
            node,
            value,
          }),
        node,
      );
      return node;
    }

    static override value(node: HTMLElement): Value | undefined {
      return states.get(node)?.read();
    }

    override detach() {
      states.get(this.domNode)?.dispose();
      super.detach();
    }
  }

  Quill.register(CanvasEmbedBlot);
  return CanvasEmbedBlot;
}
