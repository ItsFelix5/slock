import { logout } from "@slock/types";
import { confirmDialog } from "@slock/ui";
import { store } from "./store";

export function confirmLogout(): Promise<boolean> {
  return confirmDialog({
    confirmLabel: "Log out",
    danger: true,
    message: "Log out? :(",
  });
}

export async function logoutAndReload(): Promise<void> {
  store.teardown();
  await logout();
  location.reload();
}
