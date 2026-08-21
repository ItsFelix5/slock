import { ClickableInline } from "@slock/ui";
import type { JSX } from "solid-js";
import { store } from "../../lib/store";

export default function ClickableAuthorName(props: { children: JSX.Element; userId: string }) {
  return (
    <ClickableInline onActivate={() => store.users.openUserProfile(props.userId)}>
      {props.children}
    </ClickableInline>
  );
}
