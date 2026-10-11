import { FloatingPanel } from "@slock/ui";
import { lazy, Show } from "solid-js";
import ComposeDatePicker from "../../../composer/client/api/pickers/ComposeDatePicker";
import { type CanvasPicker, insertDate } from "../lib/canvasCommandContext";

const FloatingEmojiPicker = lazy(() => import("../../../emoji/client/api/FloatingEmojiPicker"));

export default function CanvasCommandPicker(props: {
  onClose: () => void;
  onReact: (annotationId: string, name: string) => void;
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
              <ComposeDatePicker
                dateOnly
                onClose={() => close(picker.quill)}
                onSelect={(timestamp) => {
                  close(picker.quill);
                  insertDate(picker.quill, timestamp);
                }}
              />
            </FloatingPanel>
          }
          when={picker.kind === "react" && picker.annotationId}
        >
          {(annotationId) => (
            <FloatingEmojiPicker
              anchor={() => picker.anchor}
              onClose={() => close(picker.quill)}
              onSelect={(name) => {
                close(picker.quill);
                props.onReact(annotationId(), name);
              }}
              open
            />
          )}
        </Show>
      )}
    </Show>
  );
}
