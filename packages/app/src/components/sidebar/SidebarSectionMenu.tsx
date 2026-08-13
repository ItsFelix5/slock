import { IconButton, Menu, MenuItem, SegmentedControl } from "@slock/ui";
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
        <IconButton
          class="sidebar-section-menu-btn"
          icon="ellipsis-vertical-filled"
          iconSize={14}
          label="Section options"
          onClick={() =>
            setSectionMenuOpen(sectionMenuOpen() === props.cat.id ? null : props.cat.id)
          }
        />
      }
    >
      <Show when={props.cat.custom}>
        <MenuItem disabled={sectionStructurePending()} onClick={() => startRename(props.cat)}>
          Rename
        </MenuItem>
      </Show>
      <Show when={props.cat.reorderable}>
        <MenuItem
          disabled={sectionStructurePending() || !canMoveSection(props.cat.id, -1)}
          icon="arrow-up"
          iconSize={14}
          onClick={() => moveSection(props.cat.id, -1)}
        >
          Move up
        </MenuItem>
        <MenuItem
          disabled={sectionStructurePending() || !canMoveSection(props.cat.id, 1)}
          icon="arrow-down"
          iconSize={14}
          onClick={() => moveSection(props.cat.id, 1)}
        >
          Move down
        </MenuItem>
      </Show>
      <div class="sidebar-section-filter">
        <SegmentedControl>
          <button
            aria-pressed={props.cat.sidebar === "hid"}
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
            aria-pressed={props.cat.sidebar === "active"}
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
            aria-pressed={props.cat.sidebar === "all"}
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
        <MenuItem danger disabled={sectionStructurePending()} onClick={deleteSection}>
          Delete section
        </MenuItem>
      </Show>
    </Menu>
  );
}
