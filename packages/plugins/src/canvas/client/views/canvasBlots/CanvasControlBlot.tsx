import { EmojiText } from "@slock/blockkit";
import { isFileId } from "@slock/slack";
import type { FileId } from "@slock/types";
import { Icon } from "@slock/ui";
import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import { render } from "@solidjs/web";
import { Show } from "solid-js";
import { canvasFileTitle, createCanvasFileQuery } from "../../lib/canvasRequests";

export interface CanvasControlValue {
  fileId?: FileId;
  id: string;
  label: string;
}

function CanvasControlLabel(props: CanvasControlValue) {
  const file = createCanvasFileQuery(() => props.fileId);
  return (
    <Show fallback={props.label} when={props.fileId}>
      <Icon name="canvas-content" size={12} />
      <EmojiText text={canvasFileTitle(file().data) ?? props.label} />
    </Show>
  );
}

const Embed = getEmbedBlot();

export class CanvasControlBlot extends Embed {
  static override blotName = "canvasControl";
  static override className = "canvas-control";
  static override tagName = "span";

  static override create(value: CanvasControlValue) {
    const node = asElement(super.create(value), "canvasControl");
    node.className = "canvas-control bk-canvas";
    node.dataset.id = value.id;
    node.dataset.label = value.label;
    if (value.fileId) node.dataset.fileId = value.fileId;
    return node;
  }

  static override value(node: HTMLElement): CanvasControlValue | undefined {
    const { fileId, id, label } = node.dataset;
    return id
      ? { fileId: fileId && isFileId(fileId) ? fileId : undefined, id, label: label ?? "" }
      : undefined;
  }

  private disposeLabel: () => void;

  constructor(...args: ConstructorParameters<typeof Embed>) {
    super(...args);
    const value =
      this.domNode instanceof HTMLElement ? CanvasControlBlot.value(this.domNode) : null;
    this.disposeLabel = render(
      () => (
        <CanvasControlLabel
          fileId={value?.fileId}
          id={value?.id ?? ""}
          label={value?.label ?? ""}
        />
      ),
      this.contentNode,
    );
  }

  override detach() {
    this.disposeLabel();
    super.detach();
  }
}

Quill.register(CanvasControlBlot);
