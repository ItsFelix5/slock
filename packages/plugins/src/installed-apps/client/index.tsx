import type { Setup } from "@slock/core";
import AppInstallers from "./AppInstallers";
import UserInstalledApps from "./UserInstalledApps";

const setup: Setup = (ctx) => {
  ctx.add("profile.meta", UserInstalledApps, { order: 50 });
  ctx.add("profile.meta", AppInstallers, { order: 50 });
};

export default setup;
