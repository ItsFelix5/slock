import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { TypingIndicator } from "@slock/ui";
import type { MessageFooterProps } from "../../messages/client/api";
import { sendTyping } from "./sendTyping";
import { createTypingSlice } from "./store";

const setup: Setup = (ctx) => {
  const store = createTypingSlice({ userById: service("users").userById });
  const currentUserId = () => service("users").currentUser()?.id;
  ctx.provide("typing", store);

  function TypingFooter(props: MessageFooterProps) {
    const names = () =>
      (props.threadTs
        ? store.typingUsersInThread(props.channelId, props.threadTs)
        : store.typingUsersInChannel(props.channelId)
      ).map((user) => user.name);
    return <TypingIndicator names={names()} />;
  }

  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "user_typing") {
        if (event.channel && event.user && event.user !== currentUserId())
          store.recordTyping(event.channel, event.thread_ts, event.user);
        return;
      }
      if (event.type === "message" && event.ts && event.channel) {
        const threadTs = event.thread_ts;
        const isThreadReply = !!threadTs && threadTs !== event.ts;
        store.clearTyping(
          event.channel,
          isThreadReply ? threadTs : undefined,
          event.user ?? event.bot_id ?? "",
        );
      }
    },
    types: ["user_typing", "message"],
  });
  ctx.add("messages.footer", TypingFooter);
  ctx.add("composer.editor", sendTyping(service("realtime").send));
};

export default setup;
