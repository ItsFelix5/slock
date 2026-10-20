import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import IconButton from "../button/IconButton";
import type { IconName } from "../media/Icon";
import FloatingPanel from "../overlay/floating/FloatingPanel";
import { type InlineFormat, toggleInlineFormat } from "./editorShortcuts";
import type Quill from "./quill";

const BUTTONS: { format: InlineFormat; icon: IconName }[] = [
  { format: "bold", icon: "bold" },
  { format: "italic", icon: "italic" },
  { format: "strike", icon: "strikethrough" },
  { format: "code", icon: "code" },
];

export interface FormatBubbleProps {
  formats: string[];
  quill: Quill | undefined;
}

export default function FormatBubble(props: FormatBubbleProps) {
  const buttons = () => BUTTONS.filter(({ format }) => props.formats.includes(format));
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal<Record<string, unknown>>({});
  const [anchor, setAnchor] = createSignal<HTMLDivElement>();

  createEffect(() => {
    const { quill } = props;
    if (!quill) return;
    const element = document.createElement("div");
    element.className = "format-bubble-anchor";
    quill.container.append(element);

    const refresh = () => {
      const range = quill.getSelection();
      const bounds = range && range.length > 0 ? quill.getBounds(range.index, range.length) : null;
      const format = range ? quill.getFormat(range) : {};
      if (
        !bounds ||
        format["code-block"] ||
        bounds.top < 0 ||
        bounds.bottom > quill.container.clientHeight
      ) {
        setOpen(false);
        return;
      }
      Object.assign(element.style, {
        height: `${bounds.height}px`,
        left: `${bounds.left}px`,
        top: `${bounds.top}px`,
        width: `${bounds.width}px`,
      });
      setActive(format);
      setAnchor(element);
      setOpen(true);
    };
    const hide = () => setOpen(false);

    quill.on("editor-change", refresh);
    quill.root.addEventListener("scroll", refresh);
    quill.root.addEventListener("mousedown", hide);
    onCleanup(() => {
      quill.off("editor-change", refresh);
      quill.root.removeEventListener("scroll", refresh);
      quill.root.removeEventListener("mousedown", hide);
      element.remove();
      setOpen(false);
    });
  });

  return (
    <Show when={buttons().length > 0}>
      <FloatingPanel
        align="center"
        anchor={anchor}
        class="format-bubble surface-popover flex-align-center gap-xs"
        gap={6}
        onMouseDown={(event) => event.preventDefault()}
        open={open()}
        placement="top"
      >
        <For each={buttons()}>
          {({ format, icon }) => (
            <IconButton
              active={!!active()[format]}
              icon={icon}
              onClick={() => props.quill && toggleInlineFormat(props.quill, format)}
              size="sm"
              tabIndex={-1}
            />
          )}
        </For>
      </FloatingPanel>
    </Show>
  );
}
