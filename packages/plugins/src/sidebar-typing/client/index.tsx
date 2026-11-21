import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import type { HomeRowEndProps } from "@slock/plugins/home/client/api";
import { definePluginSettings } from "@slock/plugins/plugins/client/api";
import { TypingIndicator } from "@slock/ui";
import { Show } from "solid-js";

const typingStore = service("typing");

const setup: Setup = (ctx) => {
  const setting = definePluginSettings(ctx, {
    showAvatars: { default: false, label: "Show avatars" },
  });
  const showAvatars = setting("showAvatars");

  function RowTyping(props: HomeRowEndProps) {
    const users = () => typingStore.typingUsersInChannel(props.id);
    return (
      <Show when={users().length}>
        <TypingIndicator avatars={showAvatars()} dotsOnly inline users={users()} />
      </Show>
    );
  }

  ctx.add("home.rowEnd", RowTyping);
};

export default setup;
