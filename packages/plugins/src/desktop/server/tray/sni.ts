import { connectSession, type Interface } from "../dbus/bus";
import type { Variant } from "../dbus/marshal";
import { iconArgb } from "./icon";
import { TRAY_ITEMS, TRAY_TITLE, type Tray, type TrayHandlers } from "./types";

const ITEM_PATH = "/StatusNotifierItem";
const MENU_PATH = "/MenuBar";
const WATCHER = "org.kde.StatusNotifierWatcher";
const ICON_SIZE = 48;

type Props = [string, Variant][];

function itemProps(label: string): Props {
  return [
    ["label", { sig: "s", value: label }],
    ["enabled", { sig: "b", value: true }],
    ["visible", { sig: "b", value: true }],
    ["type", { sig: "s", value: "standard" }],
  ];
}

function menuInterface(actions: (() => void)[]): Interface {
  const labels = [...TRAY_ITEMS];
  const child = (index: number): Variant => ({
    sig: "(ia{sv}av)",
    value: [index + 1, itemProps(labels[index] ?? ""), []],
  });
  const root = (depth: number): unknown[] => [
    0,
    [["children-display", { sig: "s", value: "submenu" }]] satisfies Props,
    depth === 0 ? [] : labels.map((_, i) => child(i)),
  ];
  const props = (id: number): Props => (id === 0 ? [] : itemProps(labels[id - 1] ?? ""));
  return {
    methods: {
      AboutToShow: { in: "i", out: "b", run: () => [false] },
      AboutToShowGroup: { in: "ai", out: "aiai", run: () => [[], []] },
      Event: {
        in: "isvu",
        out: "",
        run: ([id, event]) => {
          if (event === "clicked") actions[Number(id) - 1]?.();
          return [];
        },
      },
      EventGroup: {
        in: "a(isvu)",
        out: "ai",
        run: ([events]) => {
          for (const [id, event] of events as [number, string][]) {
            if (event === "clicked") actions[id - 1]?.();
          }
          return [[]];
        },
      },
      GetGroupProperties: {
        in: "aias",
        out: "a(ia{sv})",
        run: ([ids]) => {
          const wanted = (ids as number[]).length
            ? (ids as number[])
            : [0, ...labels.map((_, i) => i + 1)];
          return [wanted.map((id) => [id, props(id)])];
        },
      },
      GetLayout: {
        in: "iias",
        out: "u(ia{sv}av)",
        run: ([, depth]) => [1, root(Number(depth))],
      },
      GetProperty: {
        in: "is",
        out: "v",
        run: ([id, name]) => {
          const found = props(Number(id)).find(([key]) => key === name);
          return [found?.[1] ?? { sig: "s", value: "" }];
        },
      },
    },
    name: "com.canonical.dbusmenu",
    properties: {
      IconThemePath: { get: () => [], sig: "as" },
      Status: { get: () => "normal", sig: "s" },
      TextDirection: { get: () => "ltr", sig: "s" },
      Version: { get: () => 3, sig: "u" },
    },
    signals: { ItemsPropertiesUpdated: "a(ia{sv})a(ias)", LayoutUpdated: "ui" },
  };
}

function itemInterface(open: () => void): Interface {
  const pixmap = () => [[ICON_SIZE, ICON_SIZE, iconArgb(ICON_SIZE)]];
  const text = (value: string) => ({ get: () => value, sig: "s" });
  const activate = () => {
    open();
    return [];
  };
  return {
    methods: {
      Activate: { in: "ii", out: "", run: activate },
      ContextMenu: { in: "ii", out: "", run: () => [] },
      Scroll: { in: "is", out: "", run: () => [] },
      SecondaryActivate: { in: "ii", out: "", run: activate },
    },
    name: "org.kde.StatusNotifierItem",
    properties: {
      AttentionIconName: text(""),
      AttentionIconPixmap: { get: () => [], sig: "a(iiay)" },
      AttentionMovieName: text(""),
      Category: text("ApplicationStatus"),
      IconName: text(""),
      IconPixmap: { get: pixmap, sig: "a(iiay)" },
      IconThemePath: text(""),
      Id: text("slock"),
      ItemIsMenu: { get: () => false, sig: "b" },
      Menu: { get: () => MENU_PATH, sig: "o" },
      OverlayIconName: text(""),
      OverlayIconPixmap: { get: () => [], sig: "a(iiay)" },
      Status: text("Active"),
      Title: text(TRAY_TITLE),
      ToolTip: { get: () => ["", [], TRAY_TITLE, ""], sig: "(sa(iiay)ss)" },
      WindowId: { get: () => 0, sig: "u" },
    },
    signals: { NewIcon: "", NewStatus: "s", NewTitle: "", NewToolTip: "" },
  };
}

export async function sniTray(handlers: TrayHandlers): Promise<Tray> {
  const bus = await connectSession();
  try {
    const name = `org.kde.StatusNotifierItem-${process.pid}-1`;
    await bus.requestName(name);
    bus.export(ITEM_PATH, itemInterface(handlers.open));
    bus.export(MENU_PATH, menuInterface([handlers.open, handlers.quit]));
    await bus.call(WATCHER, "/StatusNotifierWatcher", WATCHER, "RegisterStatusNotifierItem", "s", [
      name,
    ]);
  } catch (error) {
    bus.close();
    throw error;
  }
  bus.onClose(handlers.lost);
  return { close: () => bus.close() };
}
