import { service } from "@slock/core/solid";
import { InlineFeedback, useEditShortcuts } from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { idsEqual } from "./categories";
import { useChannelRows } from "./channelRows";
import ChannelRow from "./rows/ChannelRow";
import { DmRow } from "./rows/DmRow";
import { SidebarSectionCaretRow } from "./rows/SidebarSectionCaretRow";
import SectionMenu from "./SectionMenu";
import type { ChannelSections } from "./useChannelSections";

const feedback = service("feedback");

function CategoryChannelRow(props: {
  catId: string;
  channelId: string;
  sections: ChannelSections;
}) {
  const unread = service("unread");
  const channel = createMemo(() => props.sections.channelById().get(props.channelId));
  const channelRows = useChannelRows();
  return (
    <Show when={channel()}>
      {(ch) => (
        <Show when={props.sections.isChannelShown(props.catId, ch())}>
          <ChannelRow channel={ch()} unread={unread.isChannelUnread(props.channelId)} />
          <For each={channelRows.rows()}>
            {(row) => <Dynamic channelId={props.channelId} component={row.view} />}
          </For>
        </Show>
      )}
    </Show>
  );
}

export default function CategorySection(props: { id: string; sections: ChannelSections }) {
  const sections = () => props.sections;
  let sectionRef: HTMLDivElement | undefined;
  useEditShortcuts({
    cancel: () => sections().setRenamingId(null),
    commit: () => void sections().commitRename(),
    enabled: () => sections().renamingId() === props.id,
    root: () => sectionRef,
  });
  const cat = createMemo(() =>
    sections()
      .categories()
      .find((c) => c.id === props.id),
  );
  const channelIds = createMemo(() => cat()?.channels.map((ch) => ch.id) ?? [], undefined, {
    equals: idsEqual,
  });
  const dms = () => {
    const category = cat();
    return category ? sections().categoryDms(category) : [];
  };
  const dragging = () => cat()?.reorderable && sections().draggingSectionId() === props.id;
  const dropping = (before: boolean) =>
    cat()?.reorderable &&
    sections().dropTarget()?.id === props.id &&
    sections().dropTarget()?.before === before &&
    sections().draggingSectionId() !== props.id;
  return (
    <div
      class="sidebar-section"
      classList={{
        "sidebar-section-dragging": dragging(),
        "sidebar-section-drop-after": dropping(false),
        "sidebar-section-drop-before": dropping(true),
      }}
      data-reorderable={cat()?.reorderable ? "true" : undefined}
      data-section-id={props.id}
      ref={sectionRef}
    >
      <div
        class="sidebar-section-header flex-align-center"
        classList={{
          "sidebar-section-header-draggable":
            cat()?.reorderable && !sections().sectionStructurePending(),
        }}
        draggable={
          cat()?.reorderable &&
          sections().renamingId() !== props.id &&
          !sections().sectionStructurePending()
        }
        onContextMenu={(e) => {
          if (!cat()?.reorderable) return;
          e.preventDefault();
          sections().setSectionMenuOpen(props.id);
        }}
        onDragEnd={sections().handleSectionDragEnd}
        onDragStart={(e) => cat()?.reorderable && sections().handleSectionDragStart(e, props.id)}
      >
        <Show
          fallback={
            <input
              aria-busy={sections().sectionStructurePending()}
              autofocus
              class="sidebar-section-rename-input"
              onBlur={() => void sections().commitRename()}
              onInput={(e) => sections().setRenameValue(e.currentTarget.value)}
              readOnly={sections().sectionStructurePending()}
              value={sections().renameValue()}
            />
          }
          when={sections().renamingId() !== props.id}
        >
          <SidebarSectionCaretRow
            caretIcon={
              sections().collapsed().has(props.id)
                ? "caret-right-filled"
                : cat()?.sidebar === "hid"
                  ? "section"
                  : "caret-down-filled"
            }
            label={cat()?.name ?? ""}
            labelAriaLabel={`Toggle read channels in ${cat()?.name ?? ""}`}
            onLabelClick={cat()?.dm ? undefined : () => sections().toggleSectionFilter(props.id)}
            onToggleOpen={() => sections().toggleCategory(props.id)}
            open={!sections().collapsed().has(props.id)}
          />
        </Show>
        <InlineFeedback
          class="sidebar-section-feedback truncate"
          feedback={feedback.get(props.id)}
        />
        <Show when={sections().renamingId() !== props.id && cat()?.reorderable ? cat() : undefined}>
          {(c) => <SectionMenu cat={c()} sections={sections()} />}
        </Show>
      </div>
      <div>
        <For each={channelIds()}>
          {(channelId) => (
            <CategoryChannelRow catId={props.id} channelId={channelId} sections={sections()} />
          )}
        </For>
        <For each={dms()}>
          {(dm) => (
            <Show when={sections().isDmShown(props.id, dm)}>
              <DmRow dm={dm} />
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
