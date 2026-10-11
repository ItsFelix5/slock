import { service } from "@slock/core/solid";
import { ClickableInline } from "@slock/ui";
import type { JSX } from "solid-js";
import "./AppBadge.css";

const usersStore = service("users");

export function AppBadge() {
  return <span class="app-badge">APP</span>;
}

export function ClickableAuthorName(props: { children: JSX.Element; userId: string }) {
  return (
    <ClickableInline onActivate={() => usersStore.openUserProfile(props.userId)}>
      {props.children}
    </ClickableInline>
  );
}
