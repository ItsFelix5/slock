import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import { createMessageNavigation } from "./navigation";
import { installPermalinkHandler } from "./permalinkHandler";
import CopyChannelLinkItem from "./views/CopyChannelLinkItem";
import CopyLinkItem from "./views/CopyLinkItem";
import ReplyLinkButton from "./views/ReplyLinkButton";

const setup: Setup = (ctx) => {
  ctx.provide(
    "message-links",
    createMessageNavigation({
      openInNewPane: service("shell.panes").openInNewPane,
      setActiveView: service("conversations").setActiveView,
    }),
  );
  installPermalinkHandler();
  ctx.add("messages.menu", CopyLinkItem, { order: 10 });
  ctx.add(
    "messages.bar",
    liveOnly((props) => <ReplyLinkButton {...props} />),
    { order: 30 },
  );
  ctx.add("messages.channelMenu", CopyChannelLinkItem, { order: 50 });
};

export default setup;
