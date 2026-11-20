import { createSignal } from "solid-js";
import {
  closePane,
  createPaneId,
  findPane,
  findPaneByContent,
  insertPane,
  isPaneRightAfter,
  replacePaneContent,
  resizePanes,
} from "../../../../../ui/src/panes/paneList";
import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";

declare module "../api/types" {
  interface PaneContents {
    mainTest: { id: string; at?: string };
    sideTest: { id: string };
    followTest: { id: string };
  }
}

const [focusedId, setFocusedId] = createSignal<string | null>(null);
export const focusCalls: string[] = [];
export { focusedId, setFocusedId };

type MockModule = (id: string, factory: () => object) => unknown;

let installed = false;

function installUiBoundary(mockModule: MockModule) {
  if (installed) return;
  installed = true;
  mockModule("@slock/ui", () => ({
    closePane,
    createPaneId,
    findPane,
    findPaneByContent,
    focusPaneById: (id: string) => {
      focusCalls.push(id);
      return true;
    },
    insertPane,
    isPaneRightAfter,
    replacePaneContent,
    resizePanes,
  }));
}

export function loadPanes(mockModule: MockModule) {
  installUiBoundary(mockModule);
  return import("./panes");
}

export function loadShellStore(mockModule: MockModule) {
  installUiBoundary(mockModule);
  return import("./index");
}

const labels = { tabLabel: () => "", view: () => "" };

export const kinds: PaneKind[] = [
  {
    identity: (content) => (content.kind === "mainTest" ? content.id : content),
    kind: "mainTest",
    primary: true,
    singleton: false,
    url: {
      parse: (segment) =>
        segment.startsWith("m-") ? { id: segment.slice(2), kind: "mainTest" } : null,
      serialize: (content) => (content.kind === "mainTest" ? `m-${content.id}` : ""),
    },
    ...labels,
  },
  {
    kind: "sideTest",
    singleton: true,
    size: 0.25,
    url: {
      parse: (segment) =>
        segment.startsWith("s-") ? { id: segment.slice(2), kind: "sideTest" } : null,
      serialize: (content) => (content.kind === "sideTest" ? `s-${content.id}` : ""),
    },
    ...labels,
  },
  { followsFocus: true, kind: "followTest", singleton: true, size: 0.4, ...labels },
];

export const main = (id: string, at?: string): PaneContent =>
  at === undefined ? { id, kind: "mainTest" } : { at, id, kind: "mainTest" };
export const side = (id: string): PaneContent => ({ id, kind: "sideTest" });
export const follow = (id: string): PaneContent => ({ id, kind: "followTest" });
