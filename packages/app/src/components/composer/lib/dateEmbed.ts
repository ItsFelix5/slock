import { formatSlackDateTokens } from "@slock/blockkit";
import { getEmbedBlot } from "@slock/ui";
import Quill from "quill";

export interface DateValue {
  ts: number;
  format: string;
  fallback: string;
}

class DateBlot extends getEmbedBlot() {
  static blotName = "date";
  static tagName = "span";

  static create(value: DateValue) {
    const node = super.create(value);
    if (!(node instanceof HTMLElement)) throw new Error("date blot produced a non-element node");
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

export function dateValue(value: unknown): DateValue | undefined {
  if (
    !(
      value &&
      typeof value === "object" &&
      "ts" in value &&
      "format" in value &&
      "fallback" in value
    )
  )
    return;
  const { ts, format, fallback } = value;
  return typeof ts === "number" && typeof format === "string" && typeof fallback === "string"
    ? { fallback, format, ts }
    : undefined;
}

export function dateMrkdwn(value: DateValue): string {
  return `<!date^${value.ts}^${value.format}|${value.fallback}>`;
}
