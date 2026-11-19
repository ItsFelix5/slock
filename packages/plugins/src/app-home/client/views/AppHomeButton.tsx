import { service } from "@slock/core/solid";
import { IconButton } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import { useAppHome } from "./useAppHome";

const appHome = service("app-home");

export default function AppHomeButton(props: MessageHeaderProps) {
  const home = useAppHome(() => props.id);
  const isOpen = () => appHome.homeChannelId() === props.id;
  return (
    <Show when={home.data?.appHome?.home_tab_enabled}>
      <IconButton
        active={isOpen()}
        class="channel-header-btn"
        icon={isOpen() ? "home-filled" : "home"}
        label="Home"
        onClick={() => (isOpen() ? appHome.closeHome() : appHome.openHome(props.id))}
      />
    </Show>
  );
}
