import type { Setup } from "@slock/core";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import AppInstallers from "./AppInstallers";
import { appInstallers, installedApps } from "./fetch";
import UserInstalledApps from "./UserInstalledApps";

const setup: Setup = (ctx) => {
  ctx.add("profile.meta", UserInstalledApps, { order: 50 });
  ctx.add("profile.meta", AppInstallers, { order: 50 });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["apps_installed", "apps_changed", "apps_uninstalled"], () => {
      installedApps.invalidateAll();
      appInstallers.invalidateAll();
    }),
  );
};

export default setup;
