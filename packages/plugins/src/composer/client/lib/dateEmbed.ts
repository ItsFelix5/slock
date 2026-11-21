import { formatSlackDateTokens } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import Quill, { getEmbedBlot } from "@slock/ui/editor/quill";
import { asElement } from "@slock/ui/editor/quillText";
import type { DateValue } from "./embedValues";

const env = service("env");

class DateBlot extends getEmbedBlot() {
  static override blotName = "date";
  static override className = "bk-date";
  static override tagName = "span";

  static override create(value: DateValue) {
    const node = asElement(super.create(value), "date");
    node.className = "bk-date";
    node.dataset.ts = String(value.ts);
    node.dataset.format = value.format;
    node.dataset.fallback = value.fallback;
    node.textContent = formatSlackDateTokens(value.format, value.ts, env.now(), value.fallback);
    return node;
  }

  static override value(node: HTMLElement): DateValue | undefined {
    const { ts, format, fallback } = node.dataset;
    return ts && format ? { fallback: fallback ?? "", format, ts: Number(ts) } : undefined;
  }
}

Quill.register(DateBlot);
