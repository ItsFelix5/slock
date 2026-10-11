import { createMemo, For } from "solid-js";
import type { HomeSectionProps } from "../api";
import CategorySection from "./CategorySection";
import { idsEqual } from "./categories";
import { useChannelSections } from "./useChannelSections";

export default function ChannelSectionList(props: HomeSectionProps) {
  const sections = useChannelSections(props.unreadsOnly);
  const categoryIds = createMemo(() => sections.categories().map((c) => c.id), undefined, {
    equals: idsEqual,
  });
  return (
    <div
      class="sidebar-section-list"
      onDragLeave={sections.handleSectionsDragLeave}
      onDragOver={sections.handleSectionsDragOver}
      onDrop={sections.handleSectionDrop}
      ref={sections.setSectionListRef}
    >
      <For each={categoryIds()}>{(id) => <CategorySection id={id} sections={sections} />}</For>
    </div>
  );
}
