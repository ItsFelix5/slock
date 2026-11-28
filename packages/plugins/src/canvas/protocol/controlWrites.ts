import type { CanvasControl } from "@slock/types";
import { encodeRawMessage } from "./rawEncode.ts";
import { CONTROL_CLASS } from "./sections.ts";
import {
  blankWrite,
  escapeCanvasHtml,
  rawMessage,
  rawString,
  rawVarint,
  type SectionWrite,
} from "./sectionWrite.ts";

export interface ControlContext {
  domain: string;
  emojiUrls: ReadonlyMap<string, string>;
  enterpriseId: string;
  viewerId: string;
}

const EMOJI_SIZE = 18;

const link = (href: string, text: string) => `<a  href="${href}">${text}</a>`;

function message(...fields: [number, ReturnType<typeof rawString>][]) {
  return new Map(fields.map(([num, value]) => [num, [value]]));
}

function emojiFields(name: string, context: ControlContext) {
  const fields = message(
    [2, rawString(name)],
    [3, rawString(`se:${name}/${context.enterpriseId}`)],
  );
  const url = context.emojiUrls.get(name);
  if (!url) return fields;
  const proxied = `https://slack-imgs.com/?c=1&o1=gu&url=${encodeURIComponent(url)}`;
  return new Map([
    ...fields,
    ...message([4, rawString(url)], [5, rawVarint(EMOJI_SIZE)], [6, rawString(proxied)]),
  ]);
}

function describe(control: CanvasControl, context: ControlContext) {
  switch (control.kind) {
    case "annotation": {
      const empty = rawMessage(new Map());
      const fields = message(
        [1, rawString(context.viewerId)],
        [4, rawVarint(0)],
        [5, rawVarint(0)],
        [9, rawVarint(2)],
        [10, empty],
        [11, empty],
        [13, rawVarint(0)],
      );
      return { field: 7, fields, label: "", type: 9 };
    }
    case "user": {
      const fields = message([1, rawString(`su:${control.userId}`)]);
      const label = link(`https://${context.domain}/team/${control.userId}`, "@user");
      return { field: 44, fields, label, type: 50 };
    }
    case "channel": {
      const fields = message([1, rawString(`sc:${control.channelId}`)]);
      const label = link(`https://slack.com/archives/${control.channelId}`, "#channel");
      return { field: 42, fields, label, type: 49 };
    }
    case "emoji": {
      const label = `:${escapeCanvasHtml(control.name)}:`;
      return { field: 48, fields: emojiFields(control.name, context), label, type: 54 };
    }
    default: {
      const fields = message([1, rawVarint(control.ms)]);
      return { field: 62, fields, label: control.label, type: 68 };
    }
  }
}

export function controlWrite(control: CanvasControl, context: ControlContext): SectionWrite {
  const { field, fields, label, type } = describe(control, context);
  const write = blankWrite(control.id);
  write.sectionClass = CONTROL_CLASS;
  write.type = type;
  write.content = encodeRawMessage(message([field, rawMessage(fields)]));
  write.label = label;
  write.path = "aaaaaaa:temp";
  return write;
}
