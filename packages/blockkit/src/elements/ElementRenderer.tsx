import type { BlockElement } from "@slock/slack-api";
import { Show } from "solid-js";
import Button from "./Button";
import ImageElement from "./ImageElement";
import Overflow from "./Overflow";

export default function ElementRenderer(props: { el: BlockElement }) {
  return (
    <Show
      fallback={
        <Show
          fallback={
            <Show
              fallback={<span class="bk-unsupported">[{props.el.type}]</span>}
              when={props.el.type === "overflow"}
            >
              <Overflow el={props.el as any} />
            </Show>
          }
          when={props.el.type === "image"}
        >
          <ImageElement el={props.el as any} />
        </Show>
      }
      when={props.el.type === "button"}
    >
      <Button el={props.el as any} />
    </Show>
  );
}
