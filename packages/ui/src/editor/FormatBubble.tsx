import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import IconButton from "../button/IconButton";
import FloatingPanel from "../overlay/floating/FloatingPanel";
import { useShortcut } from "../useShortcut";
import { toggleInlineFormat } from "./editorShortcuts";
import FormatBubbleLink from "./FormatBubbleLink";
import {
  BUBBLE_BUTTONS,
  type BubbleButton,
  isButtonActive,
  toggleBlockFormat,
} from "./formatBubbleButtons";
import type Quill from "./quill";
import type { Range } from "./quill";

const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

export interface FormatBubbleProps {
  formats: string[];
  quill: Quill | undefined;
}

export default function FormatBubble(props: FormatBubbleProps) {
  const buttons = () => BUBBLE_BUTTONS.filter(({ format }) => props.formats.includes(format));
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal<Record<string, unknown>>({});
  const [anchor, setAnchor] = createSignal<HTMLDivElement>();
  const [linkRange, setLinkRange] = createSignal<Range>();

  const startLink = () => {
    const range = props.quill?.getSelection();
    if (!range || range.length === 0) return;
    if (active().link) props.quill?.formatText(range.index, range.length, "link", false, "user");
    else setLinkRange(range);
  };

  const endLink = (restoreSelection: boolean) => {
    const range = linkRange();
    setLinkRange(undefined);
    if (range && restoreSelection) props.quill?.setSelection(range.index, range.length, "user");
  };

  const submitLink = (url: string) => {
    const range = linkRange();
    if (range && url) {
      const href = URL_SCHEME_RE.test(url) ? url : `https://${url}`;
      props.quill?.formatText(range.index, range.length, "link", href, "user");
    }
    endLink(true);
  };

  const press = (button: BubbleButton) => {
    const { quill } = props;
    if (!quill) return;
    if (button.kind === "link") startLink();
    else if (button.kind === "inline") toggleInlineFormat(quill, button.format);
    else toggleBlockFormat(quill, button, isButtonActive(button, active()));
  };

  useShortcut({
    allowInInputs: true,
    combo: { key: "u", mod: true, shift: true },
    enabled: () => open() && !linkRange() && props.formats.includes("link"),
    group: "Formatting",
    handler: startLink,
    id: "composer.link",
    label: "Link",
    manual: true,
    scope: "composer",
  });

  createEffect(() => {
    const { quill } = props;
    if (!quill) return;
    const element = document.createElement("div");
    element.className = "format-bubble-anchor";
    quill.container.append(element);

    const refresh = () => {
      if (linkRange()) return;
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
    const hide = () => {
      setLinkRange(undefined);
      setOpen(false);
    };

    quill.on("editor-change", refresh);
    quill.root.addEventListener("scroll", refresh);
    quill.root.addEventListener("mousedown", hide);
    onCleanup(() => {
      quill.off("editor-change", refresh);
      quill.root.removeEventListener("scroll", refresh);
      quill.root.removeEventListener("mousedown", hide);
      element.remove();
      hide();
    });
  });

  return (
    <Show when={buttons().length > 0}>
      <FloatingPanel
        align="center"
        anchor={anchor}
        class="format-bubble surface-popover flex-align-center gap-xs"
        gap={6}
        onMouseDown={(event) => {
          if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
        }}
        open={open()}
        placement="top"
      >
        <Show
          fallback={
            <FormatBubbleLink
              onBlur={() => endLink(false)}
              onCancel={() => endLink(true)}
              onSubmit={submitLink}
            />
          }
          when={!linkRange()}
        >
          <For each={buttons()}>
            {(button) => (
              <IconButton
                active={isButtonActive(button, active())}
                icon={button.icon}
                onClick={() => press(button)}
                size="sm"
                tabIndex={-1}
              />
            )}
          </For>
        </Show>
      </FloatingPanel>
    </Show>
  );
}
