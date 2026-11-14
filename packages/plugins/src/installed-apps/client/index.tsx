import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineKey } from "../../query/client/api";
import { gatewayHandler } from "../../realtime/client/api";
import AppInstallers from "./AppInstallers";
import { APP_INSTALLERS_QUERY, INSTALLED_APPS_QUERY } from "./fetch";
import UserInstalledApps from "./UserInstalledApps";

const installedAppsRoot = defineKey<[]>(INSTALLED_APPS_QUERY);
const appInstallersRoot = defineKey<[]>(APP_INSTALLERS_QUERY);

const setup: Setup = (ctx) => {
  const { client } = service("query");
  ctx.add("profile.meta", UserInstalledApps, { order: 50 });
  ctx.add("profile.meta", AppInstallers, { order: 50 });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["apps_installed", "apps_changed", "apps_uninstalled"], () => {
      void client.invalidateQueries({ queryKey: installedAppsRoot() });
      void client.invalidateQueries({ queryKey: appInstallersRoot() });
    }),
  );
};

export default setup;
