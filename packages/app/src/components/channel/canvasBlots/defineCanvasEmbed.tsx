import Quill from "quill";
import { BlockEmbed } from "quill/blots/block";
import type { JSX } from "solid-js";
import { render } from "solid-js/web";

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
    static blotName = config.name;
    static tagName = "div";
    static className = config.className;

    static create(value: Value) {
      // biome-ignore lint/complexity/noThisInStatic: parent embed class is resolved at runtime
      const node = super.create(value);
      if (!(node instanceof HTMLElement))
        throw new Error(`${config.name} blot produced a non-element node`);
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

    static value(node: HTMLElement): Value | undefined {
      return states.get(node)?.read();
    }

    detach() {
      states.get(this.domNode)?.dispose();
      super.detach();
    }
  }

  Quill.register(CanvasEmbedBlot);
  return CanvasEmbedBlot;
}
