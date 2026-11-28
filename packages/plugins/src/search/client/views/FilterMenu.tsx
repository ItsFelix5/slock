import { ContextMenu, IconButton, MenuItem, useContextMenu, useShortcut } from "@slock/ui";
import { For } from "solid-js";
import type { SearchSession } from "../engine/session";
import type { Modifier } from "../searchQuery";
import type { SearchQueryInputHandle } from "./SearchQueryInput";

const FILTERS: { label: string; modifier: Modifier }[] = [
  { label: "From", modifier: "from" },
  { label: "In", modifier: "in" },
  { label: "With", modifier: "with" },
  { label: "Has", modifier: "has" },
  { label: "Is", modifier: "is" },
  { label: "File type", modifier: "type" },
  { label: "After", modifier: "after" },
  { label: "Before", modifier: "before" },
  { label: "During", modifier: "during" },
];

const TOGGLES = [
  { key: "excludeBots", label: "Exclude bots" },
  { key: "myChannels", label: "Only my channels" },
] as const;

export default function FilterMenu(props: {
  input: () => SearchQueryInputHandle | undefined;
  session: SearchSession;
}) {
  let host: HTMLSpanElement | undefined;
  const menu = useContextMenu();
  const open = () => {
    if (!host?.firstElementChild) return;
    const { bottom, left } = host.firstElementChild.getBoundingClientRect();
    props.input()?.focus();
    menu.open({
      clientX: left,
      clientY: bottom,
      preventDefault: () => {},
      stopPropagation: () => {},
    });
  };
  useShortcut({
    allowInInputs: true,
    combo: { key: "f", mod: true, shift: true },
    group: "Lists",
    handler: open,
    id: "search.filters",
    label: "Search filters",
    scope: "lists",
    target: (element) => !!host?.closest(".search-surface")?.contains(element),
  });

  return (
    <span class="flex-shrink-0" ref={host}>
      <IconButton
        active={TOGGLES.some((toggle) => props.session.typed()[toggle.key])}
        icon="filters"
        onClick={open}
      />
      <ContextMenu onClose={menu.close} open={menu.isOpen()} x={menu.x()} y={menu.y()}>
        <For each={FILTERS}>
          {(filter) => (
            <MenuItem
              onClick={() => {
                menu.close();
                props.input()?.insert(`${filter.modifier}:`);
              }}
            >
              {filter.label}
            </MenuItem>
          )}
        </For>
        <For each={TOGGLES}>
          {(toggle) => (
            <MenuItem
              icon={props.session.typed()[toggle.key] ? "check" : undefined}
              onClick={() => {
                menu.close();
                const enabled = !props.session.typed()[toggle.key];
                props.session.update({ scope: "messages", [toggle.key]: enabled });
              }}
            >
              {toggle.label}
            </MenuItem>
          )}
        </For>
      </ContextMenu>
    </span>
  );
}
