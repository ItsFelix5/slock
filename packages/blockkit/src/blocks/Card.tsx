import type { BlockElement, CardBlock, CarouselBlock } from "@slock/types";
import { Icon, type IconName } from "@slock/ui";
import { For, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import ElementRenderer from "../elements/ElementRenderer";
import ImageElement from "../elements/ImageElement";

const SLACK_ICON_NAME_MAP: Record<string, IconName> = {
  clipboard: "copy",
  compass: "explore",
  cube: "blocks",
  gear: "settings",
  lightbulb: "emoji-objects",
  upload: "file-upload",
};

function slackIconName(name: string): IconName {
  return SLACK_ICON_NAME_MAP[name] ?? (name as IconName);
}

export function Card(props: { block: CardBlock; context?: BlockActionContext }) {
  return (
    <article class="bk-card">
      <Show when={props.block.hero_image}>{(heroImage) => <ImageElement el={heroImage()} />}</Show>
      <div class="bk-card-content">
        <Show
          when={
            props.block.icon || props.block.slack_icon || props.block.title || props.block.subtitle
          }
        >
          <div class="bk-card-heading">
            <Show
              fallback={
                <Show when={props.block.icon}>{(icon) => <ImageElement el={icon()} />}</Show>
              }
              when={props.block.slack_icon}
            >
              {(slackIcon) => (
                <span class="bk-card-slack-icon">
                  <Icon name={slackIconName(slackIcon().name)} size={16} />
                </span>
              )}
            </Show>
            <div>
              <Show when={props.block.title}>
                <div class="bk-card-title">
                  <BkText text={props.block.title} />
                </div>
              </Show>
              <Show when={props.block.subtitle}>
                <div class="bk-card-subtitle">
                  <BkText text={props.block.subtitle} />
                </div>
              </Show>
            </div>
          </div>
        </Show>
        <Show when={props.block.body}>
          <div class="bk-card-body">
            <BkText text={props.block.body} />
          </div>
        </Show>
        <Show when={props.block.subtext}>
          <div class="bk-card-subtext">
            <BkText text={props.block.subtext} />
          </div>
        </Show>
        <Show when={props.block.actions?.length}>
          <div class="bk-card-actions">
            <For each={props.block.actions}>
              {(el) => (
                <ElementRenderer
                  blockId={props.block.block_id}
                  context={props.context}
                  el={el as BlockElement}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </article>
  );
}

export function Carousel(props: { block: CarouselBlock; context?: BlockActionContext }) {
  return (
    <div class="bk-carousel">
      <For each={props.block.elements}>
        {(card) => <Card block={card} context={props.context} />}
      </For>
    </div>
  );
}
