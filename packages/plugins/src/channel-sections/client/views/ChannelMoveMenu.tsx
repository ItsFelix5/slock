import { service } from "@slock/core/solid";
import {
  type ChannelPlacement,
  isChannelPlacementApplied,
} from "@slock/plugins/channels/client/api/sectionMutations";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { ChannelId } from "@slock/types";
import { Icon, IconButton, InlineFeedback, Menu, MenuItem, useEditShortcuts } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import "./ChannelMoveMenu.css";

const feedback = service("feedback");

const channelsStore = service("channels");
const dmsStore = service("dms");

const creating = defineMutation<{ channelId: ChannelId; create: () => Promise<void> }>({
  key: ({ channelId }) => channelId,
  mode: "single",
  run: ({ create }) => create(),
});

type Destination =
  | { kind: "stars" }
  | { kind: "home" }
  | { kind: "section"; id: string; name: string };

interface ChannelMoveMenuProps {
  channelId: ChannelId;
  onComplete?: () => void;
  variant?: "header" | "menu-item";
}

export default function ChannelMoveMenu(props: ChannelMoveMenuProps) {
  const [open, setOpen] = createSignal(false);
  const [addingSection, setAddingSection] = createSignal(false);
  const [newSectionName, setNewSectionName] = createSignal("");

  let newSectionInputRef: HTMLInputElement | undefined;
  useEditShortcuts({
    cancel: () => {
      setAddingSection(false);
      setNewSectionName("");
    },
    enabled: addingSection,
    root: () => newSectionInputRef,
  });

  const isDm = () => !!dmsStore.dmById(props.channelId);
  const homeSectionType = () => (isDm() ? "direct_messages" : "channels");
  const destinations = () => {
    const ordered: Destination[] = [];
    for (const section of channelsStore.sections() ?? []) {
      if (section.type === "stars") ordered.push({ kind: "stars" });
      else if (section.type === homeSectionType()) ordered.push({ kind: "home" });
      else if (section.type === "standard")
        ordered.push({ kind: "section", id: section.id, name: section.name });
    }
    if (!ordered.some((destination) => destination.kind === "stars"))
      ordered.push({ kind: "stars" });
    if (!ordered.some((destination) => destination.kind === "home")) ordered.push({ kind: "home" });
    return ordered;
  };
  const isStarred = () => channelsStore.isChannelStarred(props.channelId);
  const creatingSection = () => creating.pending(props.channelId);
  const isPending = createMemo(
    () =>
      creatingSection() ||
      channelsStore.isChannelPlacementPending(props.channelId) ||
      channelsStore.isSectionStructurePending(),
  );

  const close = (complete = false) => {
    setOpen(false);
    setAddingSection(false);
    setNewSectionName("");
    if (complete) props.onComplete?.();
  };

  const move = async (to: ChannelPlacement) => {
    const outcome = await channelsStore.placeChannel(props.channelId, to);
    if (isChannelPlacementApplied(outcome)) close(true);
  };

  const submitNewSection = async (event: SubmitEvent) => {
    event.preventDefault();
    const name = newSectionName().trim();
    if (!name || isPending()) return;
    const { channelId } = props;
    await creating.run({ channelId, create: () => createAndMove(channelId, name) });
  };

  const createAndMove = async (channelId: ChannelId, name: string) => {
    const created = await channelsStore.createChannelSection(name, channelId);
    if (!created) {
      queueMicrotask(() => newSectionInputRef?.focus());
      return;
    }
    const outcome = await channelsStore.placeChannel(channelId, {
      id: created.id,
      kind: "section",
    });
    if (isChannelPlacementApplied(outcome)) return close(true);
    feedback.flash(
      channelId,
      `Created “${created.name}”, but couldn't move this channel into it.`,
      "error",
    );
    setAddingSection(false);
    setNewSectionName("");
  };

  const trigger = () =>
    props.variant === "menu-item" ? (
      <MenuItem icon="folder" onClick={() => setOpen(!open())}>
        Move to…
        <Icon class="menu-item-caret" name="caret-right" size={13} />
      </MenuItem>
    ) : (
      <IconButton
        class="channel-header-move"
        icon={isStarred() ? "star-filled" : "section"}
        iconSize={16}
        label="Move to…"
        onClick={() => setOpen(!open())}
        size="sm"
        tone="dim"
      />
    );

  return (
    <Menu
      align={props.variant === "menu-item" ? "start" : undefined}
      class={
        props.variant === "menu-item" ? "channel-move-menu-item-wrap" : "channel-header-move-wrap"
      }
      onClose={() => close()}
      onOpen={() => setOpen(true)}
      open={open()}
      openOnHover={props.variant === "menu-item"}
      panelClass="menu-panel channel-move-menu"
      placement={props.variant === "menu-item" ? "right" : "bottom"}
      trigger={trigger()}
    >
      <Show when={isPending()}>
        <span class="channel-move-menu-status">{creatingSection() ? "Creating…" : "Moving…"}</span>
      </Show>

      <div class="channel-move-menu-destinations">
        <For each={destinations()}>
          {(destination) => {
            const selected = () => channelsStore.isChannelPlacedAt(props.channelId, destination);
            const icon = () => {
              if (destination.kind === "stars") return isStarred() ? "star-filled" : "star";
              if (destination.kind === "home") return isDm() ? "message" : "channel";
              return "section";
            };
            return (
              <MenuItem
                class={["channel-move-menu-destination", { active: selected() }]}
                disabled={isPending()}
                icon={icon()}
                onClick={() => void move(destination)}
              >
                <span class="truncate">
                  {destination.kind === "section"
                    ? destination.name
                    : destination.kind === "stars"
                      ? "Starred"
                      : isDm()
                        ? "Direct messages"
                        : "Channels"}
                </span>
                <Show when={selected()}>
                  <Icon class="menu-item-check" name="check" size={13} />
                </Show>
              </MenuItem>
            );
          }}
        </For>
      </div>

      <InlineFeedback
        class="channel-move-menu-feedback truncate"
        feedback={feedback.get(props.channelId)}
        priority={1}
      />
      <div class="divider" />
      <Show
        fallback={
          <MenuItem
            class="channel-move-menu-new"
            disabled={isPending()}
            icon="plus"
            onClick={() => {
              setAddingSection(true);
              queueMicrotask(() => newSectionInputRef?.focus());
            }}
          >
            New section
          </MenuItem>
        }
        when={addingSection()}
      >
        <form class="channel-move-menu-form" onSubmit={submitNewSection}>
          <input
            class="channel-move-menu-input text-field"
            disabled={creatingSection()}
            onInput={(event) => setNewSectionName(event.currentTarget.value)}
            placeholder="Section name"
            ref={newSectionInputRef}
            value={newSectionName()}
          />
          <button
            class="channel-move-menu-create btn-reset"
            disabled={!newSectionName().trim() || creatingSection()}
            type="submit"
          >
            {creatingSection() ? "Creating…" : "Create"}
          </button>
        </form>
      </Show>
    </Menu>
  );
}
