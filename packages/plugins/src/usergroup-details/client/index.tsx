import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { lazy, Show } from "solid-js";
import type { PaneContent } from "../../shell/client/api/types";
import type { UsergroupDetailsPaneContent } from "./api";

import { createUsergroupDetails } from "./usergroupDetails";
import UsergroupHoverCard from "./views/UsergroupHoverCard";
import UsergroupMentionCard from "./views/UsergroupMentionCard";

const UsergroupDetails = lazy(() => import("./views/UsergroupDetails"));

function UsergroupView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show
      keyed
      when={narrowPaneContent<PaneContent, UsergroupDetailsPaneContent>(
        props.pane,
        "usergroup-details",
      )}
    >
      {(pane) => <UsergroupDetails pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  const usergroups = service("usergroups");
  const details = createUsergroupDetails();
  ctx.provide("usergroup-details", details);
  ctx.add(
    "shell.pane",
    {
      kind: "usergroup-details",
      tabLabel: (content) =>
        content.kind === "usergroup-details"
          ? (usergroups.usergroupById(content.usergroupId)?.name ?? "Usergroup")
          : "…",
      url: {
        parse: (segment) =>
          segment.startsWith("S") ? { kind: "usergroup-details", usergroupId: segment } : null,
        serialize: (content) => (content.kind === "usergroup-details" ? content.usergroupId : ""),
      },
      view: UsergroupView,
    },
    { order: 40 },
  );
  ctx.add("composer.mentionCard", UsergroupMentionCard);
  ctx.add("messages.blockKit", {
    onUsergroupClick: details.openUsergroupDetails,
    wrapUsergroupMention: (id, trigger) => (
      <UsergroupHoverCard usergroupId={id}>{trigger}</UsergroupHoverCard>
    ),
  });
};

export default setup;
