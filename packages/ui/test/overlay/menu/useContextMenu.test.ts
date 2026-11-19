import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { useContextMenu } from "../../../src/overlay/menu/useContextMenu";

function fakeEvent(clientX: number, clientY: number) {
  const calls = { preventDefault: 0, stopPropagation: 0 };
  return {
    calls,
    event: {
      clientX,
      clientY,
      preventDefault: () => {
        calls.preventDefault++;
      },
      stopPropagation: () => {
        calls.stopPropagation++;
      },
    },
  };
}

describe("useContextMenu", () => {
  test("starts closed at the origin", () => {
    createRoot((dispose) => {
      const menu = useContextMenu();
      flush();
      expect(menu.isOpen()).toBe(false);
      flush();
      expect([menu.x(), menu.y()]).toEqual([0, 0]);
      dispose();
    });
  });

  test("open takes the event position and swallows the native menu", () => {
    createRoot((dispose) => {
      const menu = useContextMenu();
      const { event, calls } = fakeEvent(120, 45);
      menu.open(event);
      flush();
      expect(menu.isOpen()).toBe(true);
      flush();
      expect([menu.x(), menu.y()]).toEqual([120, 45]);
      expect(calls).toEqual({ preventDefault: 1, stopPropagation: 1 });
      dispose();
    });
  });

  test("a second open moves the menu", () => {
    createRoot((dispose) => {
      const menu = useContextMenu();
      menu.open(fakeEvent(1, 2).event);
      menu.open(fakeEvent(300, 400).event);
      flush();
      expect([menu.x(), menu.y()]).toEqual([300, 400]);
      dispose();
    });
  });

  test("close resets the position", () => {
    createRoot((dispose) => {
      const menu = useContextMenu();
      menu.open(fakeEvent(9, 9).event);
      menu.close();
      flush();
      expect(menu.isOpen()).toBe(false);
      flush();
      expect([menu.x(), menu.y()]).toEqual([0, 0]);
      dispose();
    });
  });

  test("a keyboard opened menu at the origin still counts as open", () => {
    createRoot((dispose) => {
      const menu = useContextMenu();
      menu.open(fakeEvent(0, 0).event);
      flush();
      expect(menu.isOpen()).toBe(true);
      dispose();
    });
  });
});
