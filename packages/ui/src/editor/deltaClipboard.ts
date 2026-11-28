import { Delta, type Range } from "quill/core";
import Clipboard from "quill/modules/clipboard";
import { domToMarkdown } from "../markdown";

export const DELTA_CLIPBOARD_TYPE = "application/x-slock-delta";

export type PasteFilter = (pasted: Delta, from: "editor" | "html") => Delta;

function endFormat(pasted: Delta) {
  const last = pasted.ops.at(-1);
  return typeof last?.insert === "string" && last.insert.endsWith("\n")
    ? last.attributes
    : undefined;
}

export default class DeltaClipboard extends Clipboard {
  filter: PasteFilter = (pasted) => pasted;

  override convert(...args: Parameters<Clipboard["convert"]>): Delta {
    return this.filter(super.convert(...args), "html");
  }

  override onPaste(range: Range, content: { html?: string; text?: string }): void {
    const pasted = this.convert(content, this.quill.getFormat(range.index));
    const format = endFormat(pasted);
    const takesOverLine = !!format && this.quill.getText(range.index + range.length, 1) === "\n";
    const body = takesOverLine ? pasted.slice(0, pasted.length() - 1) : pasted;
    const delta = new Delta().retain(range.index).delete(range.length).concat(body);
    if (takesOverLine) delta.retain(1, format);
    this.quill.updateContents(delta, "user");
    this.quill.setSelection(range.index + body.length(), "silent");
    this.quill.scrollSelectionIntoView();
  }

  override onCopy(...args: Parameters<Clipboard["onCopy"]>) {
    const { html } = super.onCopy(...args);
    const { body } = new DOMParser().parseFromString(html, "text/html");
    return { html, text: domToMarkdown(body) };
  }

  override onCaptureCopy(event: ClipboardEvent, isCut = false): void {
    const range = event.defaultPrevented ? null : this.quill.getSelection();
    const copied = range?.length ? this.quill.getContents(range.index, range.length) : null;
    super.onCaptureCopy(event, isCut);
    if (copied) event.clipboardData?.setData(DELTA_CLIPBOARD_TYPE, JSON.stringify(copied.ops));
  }

  override onCapturePaste(event: ClipboardEvent): void {
    const json = event.clipboardData?.getData(DELTA_CLIPBOARD_TYPE);
    if (!json || event.defaultPrevented || !this.quill.isEnabled()) {
      super.onCapturePaste(event);
      return;
    }
    event.preventDefault();
    const range = this.quill.getSelection(true);
    const pasted = this.filter(new Delta(JSON.parse(json)), "editor");
    this.quill.updateContents(
      new Delta().retain(range.index).delete(range.length).concat(pasted),
      "user",
    );
    this.quill.setSelection(range.index + pasted.length(), "silent");
    this.quill.scrollSelectionIntoView();
  }
}
