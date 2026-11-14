import { formatSlackDateTokens } from "@slock/blockkit";
import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import type { DateValue } from "./embedValues";

class DateBlot extends getEmbedBlot() {
  static blotName = "date";
  static className = "bk-date";
  static tagName = "span";

  static create(value: DateValue) {
    const node = asElement(super.create(value), "date");
    node.className = "bk-date";
    node.dataset.ts = String(value.ts);
    node.dataset.format = value.format;
    node.dataset.fallback = value.fallback;
    node.textContent = formatSlackDateTokens(value.format, value.ts, value.fallback);
    return node;
  }

  static value(node: HTMLElement): DateValue | undefined {
    const { ts, format, fallback } = node.dataset;
    return ts && format ? { fallback: fallback ?? "", format, ts: Number(ts) } : undefined;
  }
}

Quill.register(DateBlot);
