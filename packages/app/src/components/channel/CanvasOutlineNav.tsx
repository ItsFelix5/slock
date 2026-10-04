import { Mrkdwn } from "@slock/blockkit";
import { For, Show } from "solid-js";
import type { OutlineItem } from "../../lib/canvas/canvasOutline";
import "./CanvasOutlineNav.css";

export default function CanvasOutlineNav(props: {
  headings: OutlineItem[];
  activeIndex: number | null;
  onNavigate: (index: number) => void;
}) {
  return (
    <Show when={props.headings.length > 1}>
      <nav class="canvas-outline-nav">
        <div class="canvas-outline-rail flex-col">
          <For each={props.headings}>
            {({ index, level }) => (
              <button
                classList={{
                  "canvas-outline-mark": true,
                  active: index === props.activeIndex,
                }}
                data-level={level}
                onClick={() => props.onNavigate(index)}
                type="button"
              />
            )}
          </For>
        </div>
        <div class="canvas-outline-popout">
          <For each={props.headings}>
            {({ index, level, text }) => (
              <button
                classList={{
                  "canvas-outline-popout-row": true,
                  truncate: true,
                  active: index === props.activeIndex,
                }}
                data-level={level}
                onClick={() => props.onNavigate(index)}
                type="button"
              >
                <Mrkdwn text={text} />
              </button>
            )}
          </For>
        </div>
      </nav>
    </Show>
  );
}
