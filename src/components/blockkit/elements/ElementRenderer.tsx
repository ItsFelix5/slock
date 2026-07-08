import { Show } from "solid-js";
import type { BlockElement } from "../types";
import Button from "./Button";
import ImageElement from "./ImageElement";
import Overflow from "./Overflow";

export default function ElementRenderer(props: { el: BlockElement }) {
  return (
    <Show
      when={props.el.type === "button"}
      fallback={
        <Show
          when={props.el.type === "image"}
          fallback={
            <Show
              when={props.el.type === "overflow"}
              fallback={<span class="bk-unsupported">[{props.el.type}]</span>}
            >
              <Overflow el={props.el as any} />
            </Show>
          }
        >
          <ImageElement el={props.el as any} />
        </Show>
      }
    >
      <Button el={props.el as any} />
    </Show>
  );
}
