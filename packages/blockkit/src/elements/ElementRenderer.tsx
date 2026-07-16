import type { BlockElement } from "@slock/slack-api";
import { Show } from "solid-js";
import type { BlockActionContext } from "../BlockKit";
import Button from "./Button";
import ImageElement from "./ImageElement";
import Overflow from "./Overflow";

export default function ElementRenderer(props: {
  blockId?: string;
  context?: BlockActionContext;
  el: BlockElement;
}) {
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
      <Button blockId={props.blockId} context={props.context} el={props.el as any} />
    </Show>
  );
}
