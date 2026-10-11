import { getHost } from "@slock/core/solid";
import { logout, refreshAccountInfo } from "@slock/slack";
import { confirmDialog } from "@slock/ui";

export function restartApp(): Promise<void> {
  refreshAccountInfo();
  history.replaceState(null, "", "/");
  return getHost().restart();
}

export function confirmLogout(): Promise<boolean> {
  return confirmDialog({
    confirmLabel: "Log out",
    danger: true,
    message: "Log out? :(",
  });
}

export async function logoutAndRestart(): Promise<void> {
  await logout();
  await restartApp();
}
