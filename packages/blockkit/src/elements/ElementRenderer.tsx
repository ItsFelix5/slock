import {
  type BlockElement,
  type ButtonElement,
  type ImageElement as ImageElementType,
  narrowByType,
  type OverflowElement,
} from "@slock/types";
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
              keyed
              when={narrowByType<BlockElement, OverflowElement>(props.el, "overflow")}
            >
              {(el) => <Overflow blockId={props.blockId} context={props.context} el={el} />}
            </Show>
          }
          keyed
          when={narrowByType<BlockElement, ImageElementType>(props.el, "image")}
        >
          {(el) => <ImageElement el={el} />}
        </Show>
      }
      keyed
      when={narrowByType<BlockElement, ButtonElement>(props.el, "button")}
    >
      {(el) => <Button blockId={props.blockId} context={props.context} el={el} />}
    </Show>
  );
}
