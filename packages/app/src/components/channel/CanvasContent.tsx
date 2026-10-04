import { Mrkdwn } from "@slock/blockkit";
import { type CanvasBlock, mapFile, resolveMediaUrl } from "@slock/types";
import { ConstrainedImage, constrainMediaDimensions } from "@slock/ui";
import { For, Match, Show, Switch } from "solid-js";
import {
  bulletListMarkerType,
  orderedListEntries,
  orderedListMarkerType,
} from "../../lib/canvasListMarkers";
import "./CanvasContent.css";

function CanvasBlockView(props: { block: CanvasBlock; index: number }) {
  return (
    <Switch>
      <Match when={props.block.type === "title"}>
        <h1 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h1>
      </Match>
      <Match when={props.block.type === "heading" && props.block.level === 1}>
        <h2 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h2>
      </Match>
      <Match when={props.block.type === "heading" && props.block.level === 2}>
        <h3 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h3>
      </Match>
      <Match when={props.block.type === "heading" && (props.block.level ?? 0) >= 3}>
        <h4 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h4>
      </Match>
      <Match when={props.block.type === "code"}>
        <pre class="canvas-panel-code">{props.block.text}</pre>
      </Match>
      <Match when={props.block.type === "callout"}>
        <div class="canvas-panel-callout">
          <Mrkdwn text={props.block.text} />
        </div>
      </Match>
      <Match when={props.block.type === "blockquote"}>
        <blockquote class="quote-bar">
          <Mrkdwn text={props.block.text} />
        </blockquote>
      </Match>
      <Match when={props.block.type === "bulletList"}>
        <ul>
          <For each={props.block.items ?? []}>
            {(item) => (
              <li
                class="canvas-panel-list-item"
                style={{
                  "--indent": item.indent,
                  "list-style-type": bulletListMarkerType(item.indent),
                }}
              >
                <Mrkdwn text={item.text} />
              </li>
            )}
          </For>
        </ul>
      </Match>
      <Match when={props.block.type === "orderedList"}>
        <ol>
          <For each={orderedListEntries(props.block.items ?? [])}>
            {(item) => (
              <li
                class="canvas-panel-list-item"
                style={{
                  "--indent": item.indent,
                  "list-style-type": orderedListMarkerType(item.indent),
                }}
                value={item.value}
              >
                <Mrkdwn text={item.text} />
              </li>
            )}
          </For>
        </ol>
      </Match>
      <Match when={props.block.type === "checklist"}>
        <ul class="canvas-panel-checklist">
          <For each={props.block.items ?? []}>
            {(item) => (
              <li class="canvas-panel-list-item" style={{ "--indent": item.indent }}>
                <input checked={item.checked ?? false} disabled type="checkbox" />
                <Mrkdwn text={item.text} />
              </li>
            )}
          </For>
        </ul>
      </Match>
      <Match when={props.block.type === "image"}>
        <div class="canvas-panel-images">
          <For each={(props.block.files ?? []).map(mapFile)}>
            {(file) => {
              const dimensions = () =>
                constrainMediaDimensions(file.width, file.height, 480, 480, 320, 240);
              return (
                <ConstrainedImage
                  alt={file.title || file.name}
                  blurSrc={file.thumbTiny ? `data:image/jpeg;base64,${file.thumbTiny}` : undefined}
                  class="canvas-panel-image"
                  fullSrc={resolveMediaUrl(file.urlPrivate)}
                  height={dimensions().height}
                  src={file.thumbUrl ?? resolveMediaUrl(file.urlPrivate)}
                  width={dimensions().width}
                />
              );
            }}
          </For>
        </div>
      </Match>
      <Match when={props.block.type === "section"}>
        <div class="canvas-panel-section">
          <For each={props.block.columns ?? []}>
            {(column) => (
              <div>
                <Mrkdwn text={column} />
              </div>
            )}
          </For>
        </div>
      </Match>
      <Match when={props.block.type === "table"}>
        <div class="canvas-panel-table-wrap">
          <table>
            <Show when={props.block.colWidths?.some((width) => width > 0)}>
              <colgroup>
                <For each={props.block.colWidths}>
                  {(width) => <col style={{ width: width > 0 ? `${width}px` : undefined }} />}
                </For>
              </colgroup>
            </Show>
            <tbody>
              <For each={props.block.rows ?? []}>
                {(row) => (
                  <tr>
                    <For each={row}>
                      {(cell) => (
                        <td>
                          <Mrkdwn text={cell} />
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Match>
      <Match when={props.block.type === "paragraph" && !props.block.text.trim()}>
        <div class="canvas-panel-spacer" />
      </Match>
      <Match when={props.block.type === "paragraph"}>
        <p>
          <Mrkdwn text={props.block.text} />
        </p>
      </Match>
    </Switch>
  );
}

export default function CanvasContent(props: { blocks: CanvasBlock[] }) {
  return (
    <div class="canvas-content input-reset">
      <For each={props.blocks}>
        {(block, index) => <CanvasBlockView block={block} index={index()} />}
      </For>
    </div>
  );
}
