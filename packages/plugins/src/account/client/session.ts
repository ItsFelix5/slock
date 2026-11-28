import { getHost, service } from "@slock/core/solid";
import { logout } from "@slock/slack/client";

const dialogs = service("shell.dialogs");

export function restartApp(): Promise<void> {
  history.replaceState(null, "", "/");
  return getHost().restart();
}

export function confirmLogout(): Promise<boolean> {
  return dialogs.confirm({
    confirmLabel: "Log out",
    danger: true,
    message: "Log out? :(",
  });
}

export async function logoutAndRestart(): Promise<void> {
  await logout();
  await restartApp();
}
