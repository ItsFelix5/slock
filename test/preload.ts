import { afterEach } from "bun:test";
import { Window } from "happy-dom";
import { trackSolidDiagnostics } from "../packages/core/src/testing";
import { solidJsx } from "../packages/installer/src/solid";

const KEEP_BUN = new Set([
  "fetch",
  "Request",
  "Response",
  "Headers",
  "URL",
  "URLSearchParams",
  "AbortController",
  "AbortSignal",
  "Blob",
  "File",
  "FormData",
  "WebSocket",
  "TextEncoder",
  "TextDecoder",
  "console",
  "performance",
  "queueMicrotask",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "structuredClone",
  "crypto",
]);

const OVERRIDE = ["Event", "CustomEvent", "EventTarget"];

function define(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

const dom = new Window({ url: "http://localhost/" });
for (const key of Object.getOwnPropertyNames(dom)) {
  if (KEEP_BUN.has(key) || (key in globalThis && !OVERRIDE.includes(key))) continue;
  define(key, Reflect.get(dom, key));
}
define("window", globalThis);
define("document", dom.document);

process.env.TZ = "Europe/Brussels";

Bun.plugin(solidJsx(/\.tsx$/));

const drainDiagnostics = trackSolidDiagnostics();

afterEach(() => {
  const found = drainDiagnostics();
  if (found.length > 0) throw new Error(`Solid diagnostics:\n${found.join("\n")}`);
});
