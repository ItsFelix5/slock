import type { Block, ContainerBlock } from "@slock/slack-api";
import { createSignal, For, type JSX, Show } from "solid-js";
import BkText from "../BkText";
import ImageElement from "../elements/ImageElement";
import RichText from "./RichText";

export default function Container(props: {
  block: ContainerBlock;
  render: (block: Block) => JSX.Element;
}) {
  const [collapsed, setCollapsed] = createSignal(
    !!props.block.is_collapsible && !!props.block.default_collapsed,
  );
  const childBlocks = () =>
    props.block.child_blocks ?? props.block.blocks ?? props.block.elements ?? [];
  const hasHeading = () =>
    !!(
      props.block.title ||
      props.block.rich_text_title ||
      props.block.subtitle ||
      props.block.icon
    );

  return (
    <section class={`bk-container bk-container--${props.block.width ?? "standard"}`}>
      <Show when={hasHeading()}>
        <div
          class="bk-container-heading"
          classList={{
            "bk-container-heading--collapsible": !!props.block.is_collapsible,
            "bk-container-heading--divided":
              !!props.block.has_header_divider && !props.block.is_collapsible,
          }}
          onClick={() => props.block.is_collapsible && setCollapsed((v) => !v)}
        >
          <Show when={props.block.icon}>{(icon) => <ImageElement el={icon()} />}</Show>
          <div class="bk-container-heading-text">
            <Show
              fallback={
                <Show when={props.block.title}>
                  <div class="bk-container-title">
                    <BkText text={props.block.title} />
                  </div>
                </Show>
              }
              when={props.block.rich_text_title}
            >
              {(title) => (
                <div class="bk-container-title">
                  <RichText block={title()} />
                </div>
              )}
            </Show>
            <Show when={props.block.subtitle}>
              <div class="bk-container-subtitle">
                <BkText text={props.block.subtitle} />
              </div>
            </Show>
          </div>
          <Show when={props.block.is_collapsible}>
            <span
              class="bk-container-caret"
              classList={{ "bk-container-caret--collapsed": collapsed() }}
            />
          </Show>
        </div>
      </Show>
      <Show when={!collapsed()}>
        <div class="bk-container-body">
          <For each={childBlocks()}>{props.render}</For>
        </div>
      </Show>
    </section>
  );
}
