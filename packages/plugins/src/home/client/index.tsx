import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { Icon, useEscapeClose, useShortcut } from "@slock/ui";
import { createSignal } from "solid-js";
import { useSidebarChannelCycle } from "./channelCycle";
import ChannelSectionList from "./views/ChannelSectionList";
import DmSectionList from "./views/DmSectionList";
import HomeView from "./views/HomeView";
import UnreadDmSection from "./views/UnreadDmSection";

const setup: Setup = (ctx) => {
  const sidebar = service("sidebar");
  const [unreadsOnly, setUnreadsOnly] = createSignal(false);
  useEscapeClose(() => setUnreadsOnly(false), unreadsOnly);
  useSidebarChannelCycle();
  useShortcut({
    combo: { key: "u", shift: true },
    enabled: () => !unreadsOnly(),
    group: "Channels and search",
    handler: () => {
      sidebar.setNavView("home");
      setUnreadsOnly(true);
    },
    id: "sidebar.unreadsOnly",
    label: "Show unread channels only",
    scope: "general",
  });
  ctx.add("home.section", UnreadDmSection, { order: 0 });
  ctx.add("home.section", ChannelSectionList, { order: 10 });
  ctx.add("home.section", DmSectionList, { order: 20 });
  ctx.add(
    "sidebar.nav",
    {
      button: () => <Icon name={unreadsOnly() ? "mark-as-unread" : "home"} size={16} />,
      id: "home",
      label: "Home",
      select: (active) => {
        if (active) setUnreadsOnly(!unreadsOnly());
        else sidebar.setNavView("home");
      },
      view: () => <HomeView unreadsOnly={unreadsOnly} />,
    },
    { order: 0 },
  );
};

export default setup;
