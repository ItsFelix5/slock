import { IconButton, Menu, MenuItem } from "@slock/ui";
import type Quill from "quill";
import { type Accessor, createSignal, For, Show } from "solid-js";
import { CALLOUT_COLORS, DEFAULT_CALLOUT_COLOR } from "../../lib/canvas/canvasCallouts";
import { CANVAS_DATE_FORMAT, dateLabel, dateMs } from "../../lib/canvas/canvasEmbeds";
import {
  COLUMNS_EMBED,
  DIVIDER_EMBED,
  FILE_EMBED,
  IMAGE_EMBED,
  TABLE_EMBED,
} from "../../lib/canvas/canvasEmbedValues";
import {
  calloutColorAt,
  insertBlock,
  insertColumns,
  insertDivider,
  insertTable,
  setCallout,
} from "../../lib/canvas/canvasFormatting";
import { uploadCanvasBlocks } from "../../lib/canvas/canvasUpload";
import { flashCaughtError } from "../../lib/feedback";
import ComposeDatePicker from "../composer/popovers/ComposeDatePicker";

const FEEDBACK_KEY = "canvas-insert";

function supports(quill: Quill | undefined, name: string): boolean {
  return !!quill?.scroll.query(name);
}

export default function CanvasInsertMenu(props: {
  editor: Accessor<Quill | undefined>;
  formats: Accessor<Record<string, unknown>>;
  newId: () => string;
}) {
  const [open, setOpen] = createSignal(false);
  const [dateOpen, setDateOpen] = createSignal(false);
  let fileInput: HTMLInputElement | undefined;

  function run(action: (quill: Quill) => void) {
    const quill = props.editor();
    setOpen(false);
    if (!quill) return;
    quill.focus();
    action(quill);
  }

  async function upload(files: FileList | null) {
    const quill = props.editor();
    if (!(quill && files) || files.length === 0) return;
    const range = quill.getSelection();
    try {
      const blocks = await uploadCanvasBlocks([...files], props.newId);
      if (range) quill.setSelection(range.index, 0);
      for (const block of blocks)
        insertBlock(quill, { name: block.name, value: block.value }, block.id);
    } catch (error) {
      flashCaughtError(FEEDBACK_KEY, error, "Couldn't upload the file");
    }
  }

  function insertDate(timestamp: number) {
    setDateOpen(false);
    const quill = props.editor();
    if (!quill) return;
    const ms = dateMs(timestamp);
    const index = quill.getSelection(true)?.index ?? quill.getLength();
    quill.insertEmbed(
      index,
      "date",
      { fallback: dateLabel(ms), format: CANVAS_DATE_FORMAT, ts: Math.floor(ms / 1000) },
      "user",
    );
    quill.insertText(index + 1, " ", "user");
    quill.setSelection(index + 2, 0, "user");
    quill.focus();
  }

  const blocks = () => supports(props.editor(), TABLE_EMBED);

  return (
    <>
      <Menu
        class="canvas-insert-menu"
        onClose={() => setOpen(false)}
        open={open()}
        panelClass="menu-panel canvas-insert-panel"
        trigger={
          <IconButton
            icon="plus"
            label="Insert"
            onClick={() => setOpen(!open())}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
          />
        }
      >
        <Show when={supports(props.editor(), "layout")}>
          <div class="canvas-callout-picker" role="group" aria-label="Callout">
            <span class="canvas-callout-label">Callout</span>
            <For each={CALLOUT_COLORS}>
              {(color) => (
                <button
                  aria-label={`${color.name} callout`}
                  aria-pressed={calloutColorAt(props.formats()) === color.value}
                  class="canvas-callout-swatch btn-reset"
                  data-color={color.value}
                  onClick={() => run((quill) => setCallout(quill, color.value))}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                />
              )}
            </For>
          </div>
          <Show when={calloutColorAt(props.formats()) !== null}>
            <MenuItem icon="close" onClick={() => run((quill) => setCallout(quill, null))}>
              Remove callout
            </MenuItem>
          </Show>
          <MenuItem
            icon="callout"
            onClick={() => run((quill) => setCallout(quill, DEFAULT_CALLOUT_COLOR))}
          >
            Callout
          </MenuItem>
        </Show>
        <Show when={blocks()}>
          <MenuItem icon="table" onClick={() => run((quill) => insertTable(quill, props.newId))}>
            Table
          </MenuItem>
        </Show>
        <Show when={supports(props.editor(), COLUMNS_EMBED)}>
          <MenuItem
            icon="column-two"
            onClick={() => run((quill) => insertColumns(quill, 2, props.newId))}
          >
            Two columns
          </MenuItem>
          <MenuItem
            icon="column-three"
            onClick={() => run((quill) => insertColumns(quill, 3, props.newId))}
          >
            Three columns
          </MenuItem>
        </Show>
        <Show when={supports(props.editor(), DIVIDER_EMBED)}>
          <MenuItem
            icon="divider"
            onClick={() => run((quill) => insertDivider(quill, props.newId()))}
          >
            Divider
          </MenuItem>
        </Show>
        <Show when={supports(props.editor(), IMAGE_EMBED) && supports(props.editor(), FILE_EMBED)}>
          <MenuItem
            icon="attachment"
            onClick={() => {
              setOpen(false);
              fileInput?.click();
            }}
          >
            Image or file
          </MenuItem>
        </Show>
        <MenuItem
          icon="calendar"
          onClick={() => {
            setOpen(false);
            setDateOpen(true);
          }}
        >
          Date
        </MenuItem>
      </Menu>
      <input
        class="canvas-file-input"
        hidden
        multiple
        onChange={(event) => {
          void upload(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
        ref={fileInput}
        type="file"
      />
      <Show when={dateOpen()}>
        <div class="canvas-date-popover">
          <ComposeDatePicker
            dateOnly
            onClose={() => setDateOpen(false)}
            onSelect={(timestamp) => insertDate(timestamp)}
          />
        </div>
      </Show>
    </>
  );
}
