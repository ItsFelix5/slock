import { EmojiText, safeUrl } from "@slock/blockkit";
import { Providers } from "@slock/plugins/shell/client/api/Providers";
import { mentionText } from "@slock/plugins/users/client/api";
import { isFileId } from "@slock/slack";
import type { FileId } from "@slock/types";
import { Icon } from "@slock/ui";
import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import { render } from "@solidjs/web";
import { Match, Switch } from "solid-js";
import { canvasFileTitle, createCanvasFileQuery } from "../../lib/canvasRequests";

interface CanvasControlValue {
  fileId?: FileId;
  id: string;
  label: string;
  url?: string;
}

function CanvasControlLabel(props: CanvasControlValue) {
  const file = createCanvasFileQuery(() => props.fileId);
  return (
    <Switch fallback={props.label}>
      <Match when={props.fileId}>
        <Icon name="canvas-content" size={12} />
        <EmojiText text={mentionText(canvasFileTitle(file().data) ?? props.label)} />
      </Match>
      <Match when={safeUrl(props.url ?? "")}>
        {(url) => (
          <a href={url()} rel="noopener noreferrer" target="_blank">
            <EmojiText text={props.label} />
          </a>
        )}
      </Match>
    </Switch>
  );
}

const Embed = getEmbedBlot();

export default class CanvasControlBlot extends Embed {
  static override blotName = "canvasControl";
  static override className = "canvas-control";
  static override tagName = "span";

  static override create(value: CanvasControlValue) {
    const node = asElement(super.create(value), "canvasControl");
    node.className = value.url ? "canvas-control" : "canvas-control bk-canvas";
    node.dataset.id = value.id;
    node.dataset.label = value.label;
    if (value.fileId) node.dataset.fileId = value.fileId;
    if (value.url) node.dataset.url = value.url;
    return node;
  }

  static override value(node: HTMLElement): CanvasControlValue | undefined {
    const { fileId, id, label, url } = node.dataset;
    return id
      ? { fileId: fileId && isFileId(fileId) ? fileId : undefined, id, label: label ?? "", url }
      : undefined;
  }

  private disposeLabel: () => void;

  constructor(...args: ConstructorParameters<typeof Embed>) {
    super(...args);
    const value =
      this.domNode instanceof HTMLElement ? CanvasControlBlot.value(this.domNode) : null;
    this.disposeLabel = render(
      () => (
        <Providers>
          <CanvasControlLabel
            fileId={value?.fileId}
            id={value?.id ?? ""}
            label={value?.label ?? ""}
            url={value?.url}
          />
        </Providers>
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
