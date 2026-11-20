import type { Setup } from "@slock/core";
import { authorStatusClass } from "./authorStatusClass";
import "./hackclubStatus.css";

const setup: Setup = (ctx) => {
  ctx.add("appearance.colors", [
    {
      derive: "@accent",
      key: "hackclubStatusUnverified",
      label: "Hack Club status (unverified)",
    },
    { derive: "@warning", key: "hackclubStatusOver18", label: "Hack Club status (over 18)" },
    { derive: "@badgeBg", key: "hackclubStatusBanned", label: "Hack Club status (banned)" },
  ]);
  ctx.add("messages.author", authorStatusClass);
};

export default setup;
