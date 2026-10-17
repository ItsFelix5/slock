import type { Tray, TrayHandlers } from "./types";

export type { Tray, TrayHandlers };

export async function createTray(handlers: TrayHandlers): Promise<Tray> {
  if (process.platform === "win32" || process.platform === "darwin") {
    return (await import("./systray")).systrayTray(handlers);
  }
  return (await import("./sni")).sniTray(handlers);
}
