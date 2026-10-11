import type { Setup } from "@slock/core";
import { registerThemeColors } from "@slock/ui";
import { authorStatusClass } from "./authorStatusClass";
import "./userStatus.css";

const setup: Setup = (ctx) => {
  ctx.onCleanup(
    registerThemeColors([
      { derive: "@accent", key: "userStatusUnverified", label: "User status (unverified)" },
      { derive: "@warning", key: "userStatusOver18", label: "User status (over 18)" },
      { derive: "@badgeBg", key: "userStatusBanned", label: "User status (banned)" },
    ]),
  );
  ctx.add("messages.author", authorStatusClass);
};

export default setup;
