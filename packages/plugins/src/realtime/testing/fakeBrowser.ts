import { FakeTarget } from "./fakeTarget";

export function installFakeBrowser(initial: { online: boolean }) {
  const win = new FakeTarget();
  const doc = Object.assign(new FakeTarget(), { visibilityState: "visible" });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  let { online } = initial;
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win, writable: true });
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc, writable: true });
  return {
    goOffline() {
      online = false;
      win.emit("offline");
    },
    goOnline() {
      online = true;
      win.emit("online");
    },
    listenerCount: () => win.listenerCount() + doc.listenerCount(),
    restore() {
      Reflect.deleteProperty(navigator, "onLine");
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    },
    setVisible(visible: boolean) {
      doc.visibilityState = visible ? "visible" : "hidden";
      doc.emit("visibilitychange");
    },
    setOnlineSilently(value: boolean) {
      online = value;
    },
  };
}
