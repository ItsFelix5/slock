import { lazyChunk } from "@slock/core/solid";
import DatePicker from "@slock/plugins/dates/client/api/DatePicker";
import { FloatingPanel } from "@slock/ui";
import { Show } from "solid-js";
import { type CanvasPicker, insertDate } from "../lib/canvasCommandContext";

const FloatingEmojiPicker = lazyChunk(
  () => import("@slock/plugins/emoji/client/api/FloatingEmojiPicker"),
);

export default function CanvasCommandPicker(props: {
  onClose: () => void;
  picker: CanvasPicker | null;
}) {
  function close(quill: CanvasPicker["quill"]) {
    props.onClose();
    quill.focus();
  }

  return (
    <Show keyed when={props.picker}>
      {(picker) => (
        <Show
          fallback={
            <FloatingPanel anchor={() => picker.anchor} open>
              <DatePicker
                dateOnly
                onClose={() => close(picker.quill)}
                onSelect={(timestamp) => {
                  close(picker.quill);
                  insertDate(picker.quill, timestamp);
                }}
              />
            </FloatingPanel>
          }
          when={picker.kind === "react" && picker}
        >
          {(react) => (
            <FloatingEmojiPicker
              anchor={() => picker.anchor}
              onClose={() => close(picker.quill)}
              onSelect={(name) => {
                close(picker.quill);
                react().pick(name);
              }}
              open
            />
          )}
        </Show>
      )}
    </Show>
  );
}
