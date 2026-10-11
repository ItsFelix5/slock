import { Skeleton } from "@slock/ui";
import { For } from "solid-js";
import "./SidebarSection.css";
import "./SidebarRow.css";

const SKELETON_ROW_WIDTHS = [120, 88, 150, 100, 70, 130, 95];

export function SidebarSkeleton() {
  return (
    <div aria-hidden="true" class="sidebar-section">
      <div class="sidebar-section-header flex-align-center">
        <Skeleton height={11} width={64} />
      </div>
      <For each={SKELETON_ROW_WIDTHS}>
        {(w) => (
          <div class="sidebar-row flex-align-center">
            <Skeleton height={12} radius={3} width={16} />
            <Skeleton height={12} width={w} />
          </div>
        )}
      </For>
    </div>
  );
}
