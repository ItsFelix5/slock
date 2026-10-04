import { QuillEditor } from "@slock/ui";
import type Quill from "quill";
import type { Op } from "quill";
import { onCleanup } from "solid-js";
import { bindCanvasKeys } from "../../lib/canvas/canvasEditorSetup";
import { createMentionHoverController } from "../composer/lib/mentionHover";
import { useMentionResolution } from "../composer/lib/mentionResolution";
import { wireEmojiAutoconvert } from "../composer/lib/quillEmoji";
import MentionHoverCard from "../composer/MentionHoverCard";
import { type CanvasServices, canvasServicesFor } from "./canvasBlots/canvasServices";
import { ignoreEmbedChurn } from "./canvasBlots/embedHistory";
import { scheduleDecorations } from "./canvasBlots/layoutDecorations";

const QUOTE_PREFIX = { format: "layout", length: 1, prefix: /^>$/, value: "quote" };

const ISOLATED_EVENTS = [
  "beforeinput",
  "compositionend",
  "compositionstart",
  "compositionupdate",
  "copy",
  "cut",
  "input",
  "keydown",
  "keypress",
  "keyup",
  "paste",
] as const;

export interface CanvasSurfaceProps {
  ariaLabel: string;
  formats: string[];
  id?: string;
  initialOps: Op[];
  nested?: boolean;
  onReady?: (quill: Quill) => void;
  placeholder?: string;
  scope: () => string;
  services: CanvasServices | undefined;
}

export default function CanvasSurface(props: CanvasSurfaceProps) {
  let quill: Quill | undefined;
  let wrapper: HTMLDivElement | undefined;
  const resolveMention = useMentionResolution(() => quill);
  const mentionHover = createMentionHoverController();

  function resolveUnknownMentions(ops: Op[]) {
    for (const op of ops) {
      const mention = typeof op.insert === "object" ? op.insert?.mention : undefined;
      if (
        typeof mention === "object" &&
        mention &&
        "id" in mention &&
        "kind" in mention &&
        mention.kind === "user" &&
        typeof mention.id === "string"
      )
        resolveMention(mention.id);
    }
  }

  function mount(editor: Quill) {
    quill = editor;
    const services = props.services ?? (wrapper ? canvasServicesFor(wrapper) : undefined);
    editor.setContents(props.initialOps, "silent");
    resolveUnknownMentions(props.initialOps);
    if (services?.readOnly) editor.disable();
    bindCanvasKeys(editor);
    ignoreEmbedChurn(editor);
    onCleanup(scheduleDecorations(editor));
    wireEmojiAutoconvert(editor);
    onCleanup(mentionHover.bind(editor));
    onCleanup(services?.register(props.scope, editor) ?? (() => undefined));
    editor.on("text-change", (_delta, _old, source) => {
      if (source === "silent") return;
      services?.afterChange(editor);
    });
    editor.root.addEventListener("focus", () => services?.activate(editor));
    editor.on("selection-change", (range) => {
      if (range) services?.activate(editor);
    });
    props.onReady?.(editor);
  }

  function isolate(element: HTMLDivElement) {
    wrapper = element;
    if (!props.nested) return;
    for (const type of ISOLATED_EVENTS) {
      const stop = (event: Event) => event.stopPropagation();
      element.addEventListener(type, stop);
      onCleanup(() => element.removeEventListener(type, stop));
    }
  }

  return (
    <div
      class="canvas-surface"
      classList={{ nested: props.nested }}
      data-scope={props.scope()}
      ref={isolate}
    >
      <QuillEditor
        ariaLabel={props.ariaLabel}
        ariaMultiline
        formats={props.formats}
        id={props.id}
        keepPastedHeaders
        linePrefixes={[QUOTE_PREFIX]}
        onReady={mount}
        placeholder={props.placeholder}
      />
      <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
    </div>
  );
}
