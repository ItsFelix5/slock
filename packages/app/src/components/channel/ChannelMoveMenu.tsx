import { Icon, IconButton, InlineFeedback, Menu, MenuItem } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  type ChannelPlacementOutcome,
  isChannelPlacementApplied,
} from "../../lib/channelSectionMutations";
import { channelIconName } from "../../lib/displayName";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import "./ChannelMoveMenu.css";

export interface ChannelMoveMenuProps {
  channelId: string;
  channelTitle: string;
  onComplete?: () => void;
  variant?: "header" | "menu-item";
}

export default function ChannelMoveMenu(props: ChannelMoveMenuProps) {
  const [open, setOpen] = createSignal(false);
  const [addingSection, setAddingSection] = createSignal(false);
  const [newSectionName, setNewSectionName] = createSignal("");
  const [creatingSection, setCreatingSection] = createSignal(false);

  let newSectionInputRef: HTMLInputElement | undefined;

  const sections = createMemo(
    () => store.channels.sections()?.filter((section) => section.type === "standard") ?? [],
  );
  const currentSectionId = createMemo(
    () => sections().find((section) => section.channelIds.includes(props.channelId))?.id ?? null,
  );
  const isStarred = createMemo(() => store.channels.isChannelStarred(props.channelId));
  const isInChannels = createMemo(() => !(isStarred() || currentSectionId()));
  const isPrivate = createMemo(() => !!store.channels.channelById(props.channelId)?.private);
  const isPending = createMemo(
    () =>
      creatingSection() ||
      store.channels.isChannelPlacementPending(props.channelId) ||
      store.channels.isSectionStructurePending(),
  );

  const close = (complete = false) => {
    setOpen(false);
    setAddingSection(false);
    setNewSectionName("");
    if (complete) props.onComplete?.();
  };

  const finishPlacement = (outcome: ChannelPlacementOutcome) => {
    if (isChannelPlacementApplied(outcome)) close(true);
  };

  const moveToStarred = async () => {
    if (isStarred()) {
      close(true);
      return;
    }
    finishPlacement(await store.channels.toggleChannelStar(props.channelId));
  };

  const moveToChannels = async () => {
    if (isStarred()) {
      finishPlacement(await store.channels.toggleChannelStar(props.channelId));
      return;
    }
    if (!currentSectionId()) {
      close(true);
      return;
    }
    finishPlacement(await store.channels.moveChannelToSection(props.channelId, null));
  };

  const moveToSection = async (sectionId: string) => {
    if (!isStarred() && currentSectionId() === sectionId) {
      close(true);
      return;
    }
    finishPlacement(await store.channels.moveChannelToSection(props.channelId, sectionId));
  };

  const submitNewSection = async (event: SubmitEvent) => {
    event.preventDefault();
    const name = newSectionName().trim();
    if (!name || isPending()) return;
    setCreatingSection(true);
    try {
      const created = await store.channels.createChannelSection(name, props.channelId);
      if (!created) {
        queueMicrotask(() => newSectionInputRef?.focus());
        return;
      }
      const outcome = await store.channels.moveChannelToSection(props.channelId, created.id);
      if (!isChannelPlacementApplied(outcome)) {
        actionFeedback.flash(
          props.channelId,
          `Created “${created.name}”, but couldn't move this channel into it.`,
          "error",
        );
        setAddingSection(false);
        setNewSectionName("");
        return;
      }
      close(true);
    } finally {
      setCreatingSection(false);
    }
  };

  const trigger = () =>
    props.variant === "menu-item" ? (
      <MenuItem class="channel-move-menu-trigger" icon="folder" onClick={() => setOpen(!open())}>
        Move to…
        <Icon class="channel-move-menu-trigger-caret" name="caret-right" size={13} />
      </MenuItem>
    ) : (
      <IconButton
        class="channel-header-star"
        icon={isStarred() ? "star-filled" : "section"}
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
        props.variant === "menu-item" ? "channel-move-menu-item-wrap" : "channel-header-star-wrap"
      }
      onClose={() => close()}
      open={open()}
      panelClass="menu-panel channel-move-menu"
      placement={props.variant === "menu-item" ? "right" : "bottom"}
      trigger={trigger()}
    >
      <div class="channel-move-menu-heading">
        <span class="menu-label">Move to</span>
        <span class="channel-move-menu-channel truncate">
          <Icon name={channelIconName(isPrivate())} size={11} />
          {props.channelTitle}
        </span>
        <Show when={isPending()}>
          <span class="channel-move-menu-status">
            {creatingSection() ? "Creating…" : "Moving…"}
          </span>
        </Show>
      </div>

      <div class="channel-move-menu-destinations">
        <MenuItem
          aria-current={isStarred() ? "true" : undefined}
          class="channel-move-menu-destination"
          disabled={isPending()}
          icon={isStarred() ? "star-filled" : "star"}
          onClick={() => void moveToStarred()}
        >
          <span>Starred</span>
          <Show when={isStarred()}>
            <Icon class="channel-move-menu-check" name="check" size={13} />
          </Show>
        </MenuItem>
        <MenuItem
          aria-current={isInChannels() ? "true" : undefined}
          class="channel-move-menu-destination"
          disabled={isPending()}
          icon="channel"
          onClick={() => void moveToChannels()}
        >
          <span>Channels</span>
          <Show when={isInChannels()}>
            <Icon class="channel-move-menu-check" name="check" size={13} />
          </Show>
        </MenuItem>

        <Show when={sections().length > 0}>
          <div class="channel-move-menu-section-label menu-label">Sections</div>
          <For each={sections()}>
            {(section) => {
              const selected = () => !isStarred() && currentSectionId() === section.id;
              return (
                <MenuItem
                  aria-current={selected() ? "true" : undefined}
                  class="channel-move-menu-destination"
                  disabled={isPending()}
                  icon="section"
                  onClick={() => void moveToSection(section.id)}
                >
                  <span class="truncate">{section.name}</span>
                  <Show when={selected()}>
                    <Icon class="channel-move-menu-check" name="check" size={13} />
                  </Show>
                </MenuItem>
              );
            }}
          </For>
        </Show>
      </div>

      <InlineFeedback
        class="channel-move-menu-feedback"
        feedback={actionFeedback.get(props.channelId)}
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
            class="channel-move-menu-input search-input"
            disabled={creatingSection()}
            onInput={(event) => setNewSectionName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              setAddingSection(false);
              setNewSectionName("");
            }}
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
