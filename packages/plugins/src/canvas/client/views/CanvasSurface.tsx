import MentionHoverCard from "@slock/plugins/composer/client/api/editor/MentionHoverCard";
import { createMentionHoverController } from "@slock/plugins/composer/client/api/editor/mentionHover";
import { useMentionResolution } from "@slock/plugins/composer/client/api/editor/mentionResolution";
import { emojiAutoconvert } from "@slock/plugins/emoji/client/api/emojiAutoconvert";
import { dispatchShortcut } from "@slock/ui";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import type Quill from "@slock/ui/editor/quill";
import type { Op } from "@slock/ui/editor/quill";
import { onCleanup, onSettled } from "solid-js";
import { bindCanvasKeys } from "../lib/canvasEditorSetup";
import { pasteCanvasContent, pasteImageLinks, pasteTables } from "../lib/canvasPaste";
import { type CanvasServices, canvasServicesFor } from "./canvasBlots/canvasServices";
import { ignoreEmbedChurn, withoutHistory } from "./canvasBlots/embedHistory";
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

// A disabled editor has no caret, which keyboard users need to select text and open links.
// Quill only counts "true" as enabled, so it keeps refusing edits.
function keepCaret(editor: Quill) {
  editor.root.contentEditable = "plaintext-only";
  editor.root.addEventListener("beforeinput", (event) => event.preventDefault());
  // IME input cannot be cancelled, so redraw from the unchanged contents.
  editor.on("composition-end", () => editor.setContents(editor.getContents(), "silent"));
}

interface CanvasSurfaceProps {
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
  let mountedServices: CanvasServices | undefined;
  const disposers: Array<() => void> = [];
  onCleanup(() => {
    const editor = quill;
    quill = undefined;
    for (const dispose of disposers.splice(0)) dispose();
    // Embeds are separate roots. The final save reads them during this teardown, so they go after it.
    if (editor) queueMicrotask(() => editor.scroll.detach());
  });
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
        (mention.kind === "user" || mention.kind === "channel") &&
        typeof mention.id === "string"
      )
        resolveMention(mention.id, mention.kind);
    }
  }

  function mount(editor: Quill) {
    quill = editor;
    queueMicrotask(() => {
      if (quill === editor) load(editor);
    });
  }

  // Embeds render their own Solid root, which throws inside QuillEditor's onSettled.
  function load(editor: Quill) {
    const services = props.services ?? (wrapper ? canvasServicesFor(wrapper) : undefined);
    mountedServices = services;
    withoutHistory(editor, () => editor.setContents(props.initialOps, "silent"));
    resolveUnknownMentions(props.initialOps);
    if (services && services.access !== "edit") {
      editor.disable();
      keepCaret(editor);
    }
    bindCanvasKeys(editor);
    pasteImageLinks(editor);
    if (services) {
      pasteCanvasContent(editor, services.movesAnnotation);
      pasteTables(editor, services.newId);
    }
    ignoreEmbedChurn(editor);
    disposers.push(
      scheduleDecorations(editor),
      emojiAutoconvert(editor),
      mentionHover.bind(editor),
      services?.register(props.scope, editor) ?? (() => undefined),
    );
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

  onSettled(() => {
    if (!(props.nested && wrapper)) return;
    const element = wrapper;
    const stop = (event: Event) => {
      // Shortcuts listen on the document, which a stopped event never reaches.
      if (event instanceof KeyboardEvent && event.type === "keydown") dispatchShortcut(event);
      event.stopPropagation();
    };
    for (const type of ISOLATED_EVENTS) element.addEventListener(type, stop);
    return () => {
      for (const type of ISOLATED_EVENTS) element.removeEventListener(type, stop);
    };
  });

  return (
    <div
      class={["canvas-surface", { nested: props.nested }]}
      data-scope={props.scope()}
      ref={wrapper}
    >
      <QuillEditor
        ariaLabel={props.ariaLabel}
        ariaMultiline
        checklists
        formats={props.formats}
        id={props.id}
        keepPastedHeaders
        linePrefixes={[QUOTE_PREFIX]}
        onPasteFiles={(files) => quill && mountedServices?.upload(quill, [...files])}
        onReady={mount}
        placeholder={props.placeholder}
      />
      <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
    </div>
  );
}
