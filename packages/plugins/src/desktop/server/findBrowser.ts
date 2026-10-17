import { homedir, platform } from "node:os";
import { join } from "node:path";

const PATH_NAMES = [
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
  "brave-browser",
  "brave",
  "microsoft-edge-stable",
  "microsoft-edge",
  "vivaldi",
  "chrome",
  "msedge",
];

const MAC_APPS = ["Google Chrome", "Chromium", "Brave Browser", "Microsoft Edge", "Vivaldi"];

function windowsPaths(): string[] {
  const roots = [Bun.env["PROGRAMFILES"], Bun.env["PROGRAMFILES(X86)"], Bun.env["LOCALAPPDATA"]];
  const apps = [
    ["Google", "Chrome", "Application", "chrome.exe"],
    ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    ["Microsoft", "Edge", "Application", "msedge.exe"],
  ];
  return roots.flatMap((root) => (root ? apps.map((app) => join(root, ...app)) : []));
}

function macPaths(): string[] {
  return MAC_APPS.flatMap((name) =>
    ["/Applications", join(homedir(), "Applications")].map((dir) =>
      join(dir, `${name}.app`, "Contents", "MacOS", name),
    ),
  );
}

/** First installed Chromium based browser, or `SLOCK_BROWSER` when set. */
export async function findBrowser(): Promise<string | undefined> {
  if (Bun.env.SLOCK_BROWSER) return Bun.env.SLOCK_BROWSER;
  for (const name of PATH_NAMES) {
    const found = Bun.which(name);
    if (found) return found;
  }
  const os = platform();
  const candidates = os === "darwin" ? macPaths() : os === "win32" ? windowsPaths() : [];
  for (const path of candidates) if (await Bun.file(path).exists()) return path;
}

/** Own profile, so the app window has no tabs, extensions or the user's browsing data. */
export function profileDir(): string {
  const os = platform();
  const base =
    os === "win32"
      ? (Bun.env["APPDATA"] ?? join(homedir(), "AppData", "Roaming"))
      : os === "darwin"
        ? join(homedir(), "Library", "Application Support")
        : (Bun.env["XDG_DATA_HOME"] ?? join(homedir(), ".local", "share"));
  return join(base, "slock", "app");
}
