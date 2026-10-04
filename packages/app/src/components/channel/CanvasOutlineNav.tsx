import { Mrkdwn } from "@slock/blockkit";
import type { CanvasBlock } from "@slock/types";
import { For, Show } from "solid-js";
import "./CanvasOutlineNav.css";

function headingLevel(block: CanvasBlock): number {
  return block.type === "title" ? 0 : (block.level ?? 1);
}

export default function CanvasOutlineNav(props: {
  headings: { block: CanvasBlock; index: number }[];
  activeIndex: number | null;
  onNavigate: (index: number) => void;
}) {
  return (
    <Show when={props.headings.length > 1}>
      <nav class="canvas-outline-nav">
        <div class="canvas-outline-rail flex-col">
          <For each={props.headings}>
            {({ block, index }) => (
              <button
                classList={{
                  "canvas-outline-mark": true,
                  active: index === props.activeIndex,
                }}
                data-level={headingLevel(block)}
                onClick={() => props.onNavigate(index)}
                type="button"
              />
            )}
          </For>
        </div>
        <div class="canvas-outline-popout">
          <For each={props.headings}>
            {({ block, index }) => (
              <button
                classList={{
                  "canvas-outline-popout-row": true,
                  truncate: true,
                  active: index === props.activeIndex,
                }}
                data-level={headingLevel(block)}
                onClick={() => props.onNavigate(index)}
                type="button"
              >
                <Mrkdwn text={block.text} />
              </button>
            )}
          </For>
        </div>
      </nav>
    </Show>
  );
}
