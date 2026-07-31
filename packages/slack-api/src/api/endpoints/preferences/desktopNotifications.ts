export function resolveDesktopNotificationsEnabled(value: unknown, fallback: boolean): boolean {
  if (value === "on") return true;
  if (value === "off") return false;
  return fallback;
}
