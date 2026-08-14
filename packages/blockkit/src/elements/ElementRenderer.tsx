import type {
  BlockElement,
  ButtonElement,
  ImageElement as ImageElementType,
  OverflowElement,
} from "@slock/slack-api";
import { Show } from "solid-js";
import type { BlockActionContext } from "../BlockKit";
import Button from "./Button";
import Controls from "./Controls";
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
              fallback={<Controls blockId={props.blockId} context={props.context} el={props.el} />}
              when={props.el.type === "overflow"}
            >
              <Overflow
                blockId={props.blockId}
                context={props.context}
                el={props.el as OverflowElement}
              />
            </Show>
          }
          when={props.el.type === "image"}
        >
          <ImageElement el={props.el as ImageElementType} />
        </Show>
      }
      when={props.el.type === "button"}
    >
      <Button blockId={props.blockId} context={props.context} el={props.el as ButtonElement} />
    </Show>
  );
}
