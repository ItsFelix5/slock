import { Icon, InlineFeedback, Menu, Tooltip } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { actionFeedback, store } from "../../lib/store";
import {
  type ChannelPlacementOutcome,
  isChannelPlacementApplied,
} from "../../lib/store/slices/entities/mutations/channelPlacementOutcome";
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
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
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
          `Created “${created.name}”, but couldn’t move this channel into it.`,
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
      <button
        aria-label={`Move #${props.channelTitle} to another section`}
        class="menu-item channel-move-menu-trigger"
        onClick={() => setOpen(!open())}
        type="button"
      >
        <Icon name="folder" size={15} />
        Move to…
        <Icon class="channel-move-menu-trigger-caret" name="caret-right" size={13} />
      </button>
    ) : (
      <Tooltip content="Move to…">
        <button
          aria-label="Move to…"
          class="channel-header-star btn-reset icon-btn sm icon-action text-dim"
          classList={{ active: isStarred() }}
          onClick={() => setOpen(!open())}
          type="button"
        >
          <Icon name={isStarred() ? "star-filled" : "section"} size={16} />
        </button>
      </Tooltip>
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
          <Show fallback="#" when={isPrivate()}>
            <Icon name="lock" size={11} />
          </Show>
          {props.channelTitle}
        </span>
        <Show when={isPending()}>
          <span aria-live="polite" class="channel-move-menu-status" role="status">
            {creatingSection() ? "Creating…" : "Moving…"}
          </span>
        </Show>
      </div>

      <div aria-busy={isPending()} class="channel-move-menu-destinations">
        <button
          aria-current={isStarred() ? "true" : undefined}
          class="menu-item channel-move-menu-destination"
          disabled={isPending()}
          onClick={() => void moveToStarred()}
          type="button"
        >
          <Icon name={isStarred() ? "star-filled" : "star"} size={15} />
          <span>Starred</span>
          <Show when={isStarred()}>
            <Icon class="channel-move-menu-check" name="check" size={13} />
          </Show>
        </button>
        <button
          aria-current={isInChannels() ? "true" : undefined}
          class="menu-item channel-move-menu-destination"
          disabled={isPending()}
          onClick={() => void moveToChannels()}
          type="button"
        >
          <Icon name="channel" size={15} />
          <span>Channels</span>
          <Show when={isInChannels()}>
            <Icon class="channel-move-menu-check" name="check" size={13} />
          </Show>
        </button>

        <Show when={sections().length > 0}>
          <div class="channel-move-menu-section-label menu-label">Sections</div>
          <For each={sections()}>
            {(section) => {
              const selected = () => !isStarred() && currentSectionId() === section.id;
              return (
                <button
                  aria-current={selected() ? "true" : undefined}
                  class="menu-item channel-move-menu-destination"
                  disabled={isPending()}
                  onClick={() => void moveToSection(section.id)}
                  type="button"
                >
                  <Icon name="section" size={15} />
                  <span class="truncate">{section.name}</span>
                  <Show when={selected()}>
                    <Icon class="channel-move-menu-check" name="check" size={13} />
                  </Show>
                </button>
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
          <button
            class="menu-item channel-move-menu-new"
            disabled={isPending()}
            onClick={() => {
              setAddingSection(true);
              queueMicrotask(() => newSectionInputRef?.focus());
            }}
            type="button"
          >
            <Icon name="plus" size={15} />
            New section
          </button>
        }
        when={addingSection()}
      >
        <form class="channel-move-menu-form" onSubmit={submitNewSection}>
          <input
            aria-label="New section name"
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
