import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import type { MessageFooterProps } from "@slock/plugins/messages/client/api";
import { ifPresent, parseChannelId, parseTs, parseUserId } from "@slock/slack";
import { TypingIndicator } from "@slock/ui";
import { sendTyping } from "./sendTyping";
import { createTypingSlice } from "./store";

const setup: Setup = (ctx) => {
  const store = createTypingSlice({ userById: service("users").userById });
  const currentUserId = () => service("users").currentUser()?.id;
  ctx.provide("typing", store);

  function TypingFooter(props: MessageFooterProps) {
    const users = () =>
      props.threadTs
        ? store.typingUsersInThread(props.channelId, props.threadTs)
        : store.typingUsersInChannel(props.channelId);
    return <TypingIndicator users={users()} />;
  }

  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "user_typing") {
        const channel = ifPresent(parseChannelId, event.channel);
        const user = ifPresent(parseUserId, event.user);
        if (channel && user && user !== currentUserId())
          store.recordTyping(channel, ifPresent(parseTs, event.thread_ts), user);
        return;
      }
      if (event.type === "message") {
        const channel = ifPresent(parseChannelId, event.channel);
        const ts = ifPresent(parseTs, event.ts);
        const author = ifPresent(parseUserId, event.user ?? event.bot_id);
        if (!(channel && ts && author)) return;
        const threadTs = ifPresent(parseTs, event.thread_ts);
        store.clearTyping(channel, threadTs && threadTs !== ts ? threadTs : undefined, author);
      }
    },
    types: ["user_typing", "message"],
  });
  ctx.add("messages.footer", TypingFooter);
  ctx.add("composer.editor", sendTyping(service("realtime").send));
};

export default setup;
