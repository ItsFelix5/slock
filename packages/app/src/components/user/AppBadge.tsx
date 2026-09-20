import { ClickableInline } from "@slock/ui";
import type { JSX } from "solid-js";
import { store } from "../../lib/store";
import "./AppBadge.css";

export function AppBadge() {
  return <span class="app-badge">APP</span>;
}

export function ClickableAuthorName(props: { children: JSX.Element; userId: string }) {
  return (
    <ClickableInline onActivate={() => store.users.openUserProfile(props.userId)}>
      {props.children}
    </ClickableInline>
  );
}
