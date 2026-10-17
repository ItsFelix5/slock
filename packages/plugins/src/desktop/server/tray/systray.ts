import { iconIco, iconPng } from "./icon";
import { TRAY_ITEMS, TRAY_TITLE, type Tray, type TrayHandlers } from "./types";

type SysTrayModule = typeof import("systray2");

const ICON_SIZE = 32;

export async function systrayTray(handlers: TrayHandlers): Promise<Tray> {
  const module = (await import("systray2")) as unknown as SysTrayModule & {
    default?: SysTrayModule;
  };
  const SysTray = module.default?.default ?? module.default;
  if (!SysTray) throw new Error("systray2 did not load");
  const icon = process.platform === "win32" ? iconIco(ICON_SIZE) : iconPng(ICON_SIZE);
  const tray = new SysTray({
    menu: {
      icon: Buffer.from(icon).toString("base64"),
      items: TRAY_ITEMS.map((title) => ({ enabled: true, title, tooltip: "" })),
      title: "",
      tooltip: TRAY_TITLE,
    },
  });
  tray.onError(handlers.lost);
  tray.onExit(handlers.lost);
  await tray.onClick((action) => {
    if (action.seq_id === 0) handlers.open();
    else if (action.seq_id === 1) handlers.quit();
  });
  await tray.ready();
  return { close: () => void tray.kill(false) };
}
