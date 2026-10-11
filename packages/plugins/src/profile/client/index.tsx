import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { Show } from "solid-js";
import type { PaneContent } from "../../shell/client/api/types";
import type { ProfilePaneContent } from "./api";
import UserHoverCard from "./views/UserHoverCard";
import UserMentionCard from "./views/UserMentionCard";
import UserProfile from "./views/UserProfile";

const USER_SEGMENT = /^[UB]/;

function ProfileView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show keyed when={narrowPaneContent<PaneContent, ProfilePaneContent>(props.pane, "profile")}>
      {(pane) => <UserProfile pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  const users = service("users");
  const dms = service("dms");
  ctx.add(
    "shell.pane",
    {
      kind: "profile",
      tabLabel: (content) =>
        content.kind === "profile" ? (users.userById(content.userId)?.name ?? "Profile") : "…",
      url: {
        parse: (segment) =>
          USER_SEGMENT.test(segment) ? { kind: "profile", userId: segment } : null,
        serialize: (content) => (content.kind === "profile" ? content.userId : ""),
      },
      view: ProfileView,
    },
    { order: 30 },
  );
  ctx.add("messages.titleOpen", (view) => {
    const userId = view.kind === "dm" ? dms.dmById(view.id)?.userId : undefined;
    if (userId) users.openUserProfile(userId);
  });
  ctx.add("composer.mentionCard", UserMentionCard);
  ctx.add("messages.blockKit", {
    wrapUserMention: (id, trigger) => <UserHoverCard userId={id}>{trigger}</UserHoverCard>,
  });
};

export default setup;
