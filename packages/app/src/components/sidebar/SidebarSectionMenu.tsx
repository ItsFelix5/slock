import { Icon, Menu, SegmentedControl, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import type { Category, SidebarContext } from "./sidebarCategories";

export default function SidebarSectionMenu(props: { cat: Category; context: SidebarContext }) {
  const {
    canMoveSection,
    deleteChannelSection,
    isSectionSidebarPending,
    moveSection,
    preferencesError,
    preferencesLoading,
    sectionMenuOpen,
    sectionStructurePending,
    setChannelSectionSidebar,
    setSectionMenuOpen,
    startRename,
  } = props.context;
  const filterDisabled = () =>
    isSectionSidebarPending(props.cat.id) ||
    sectionStructurePending() ||
    preferencesLoading() ||
    !!preferencesError();
  const deleteSection = () => {
    setSectionMenuOpen(null);
    // biome-ignore lint/suspicious/noAlert: Deleting a section requires explicit confirmation.
    const confirmed = confirm(
      `Delete section "${props.cat.name}"? Its channels won't be removed from the workspace.`,
    );
    if (confirmed) void deleteChannelSection(props.cat.id);
  };

  return (
    <Menu
      align="end"
      class="sidebar-section-menu-wrap"
      onClose={() => setSectionMenuOpen(null)}
      open={sectionMenuOpen() === props.cat.id}
      panelClass="menu-panel sidebar-section-menu"
      trigger={
        <Tooltip content="Section options">
          <button
            aria-label="Section options"
            class="sidebar-section-menu-btn btn-reset icon-btn icon-action"
            onClick={() =>
              setSectionMenuOpen(sectionMenuOpen() === props.cat.id ? null : props.cat.id)
            }
            type="button"
          >
            <Icon name="ellipsis-vertical-filled" size={14} />
          </button>
        </Tooltip>
      }
    >
      <Show when={props.cat.custom}>
        <button
          class="menu-item"
          disabled={sectionStructurePending()}
          onClick={() => startRename(props.cat)}
          type="button"
        >
          Rename
        </button>
      </Show>
      <Show when={props.cat.reorderable}>
        <button
          class="menu-item"
          disabled={sectionStructurePending() || !canMoveSection(props.cat.id, -1)}
          onClick={() => moveSection(props.cat.id, -1)}
          type="button"
        >
          <Icon name="arrow-up" size={14} /> Move up
        </button>
        <button
          class="menu-item"
          disabled={sectionStructurePending() || !canMoveSection(props.cat.id, 1)}
          onClick={() => moveSection(props.cat.id, 1)}
          type="button"
        >
          <Icon name="arrow-down" size={14} /> Move down
        </button>
      </Show>
      <div class="sidebar-section-filter">
        <SegmentedControl>
          <button
            class="segmented-control-btn"
            classList={{ active: props.cat.sidebar === "hid" }}
            disabled={filterDisabled()}
            onClick={() => {
              setSectionMenuOpen(null);
              void setChannelSectionSidebar(props.cat.id, "hid");
            }}
            type="button"
          >
            Unread
          </button>
          <button
            class="segmented-control-btn"
            classList={{ active: props.cat.sidebar === "active" }}
            disabled={filterDisabled()}
            onClick={() => {
              setSectionMenuOpen(null);
              void setChannelSectionSidebar(props.cat.id, "active");
            }}
            type="button"
          >
            Active
          </button>
          <button
            class="segmented-control-btn"
            classList={{ active: props.cat.sidebar === "all" }}
            disabled={filterDisabled()}
            onClick={() => {
              setSectionMenuOpen(null);
              void setChannelSectionSidebar(props.cat.id, "all");
            }}
            type="button"
          >
            All
          </button>
        </SegmentedControl>
      </div>
      <Show when={props.cat.custom}>
        <button
          class="menu-item danger"
          disabled={sectionStructurePending()}
          onClick={deleteSection}
          type="button"
        >
          Delete section
        </button>
      </Show>
    </Menu>
  );
}
