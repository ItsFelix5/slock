import { homedir, platform } from "node:os";
import { join } from "node:path";

const PATH_NAMES = [
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
  "brave-browser",
  "brave",
  "helium",
  "ungoogled-chromium",
  "microsoft-edge-stable",
  "microsoft-edge",
  "vivaldi",
  "chrome",
  "msedge",
];

const MAC_APPS = [
  "Google Chrome",
  "Chromium",
  "Brave Browser",
  "Microsoft Edge",
  "Vivaldi",
  "Helium",
];

function windowsPaths(): string[] {
  const roots = [Bun.env["PROGRAMFILES"], Bun.env["PROGRAMFILES(X86)"], Bun.env["LOCALAPPDATA"]];
  const apps = [
    ["Google", "Chrome", "Application", "chrome.exe"],
    ["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    ["Microsoft", "Edge", "Application", "msedge.exe"],
    ["imput", "Helium", "Application", "chrome.exe"],
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

export async function findBrowser(): Promise<string | undefined> {
  for (const name of PATH_NAMES) {
    const found = Bun.which(name);
    if (found) return found;
  }
  const os = platform();
  const candidates = os === "darwin" ? macPaths() : os === "win32" ? windowsPaths() : [];
  for (const path of candidates) if (await Bun.file(path).exists()) return path;
}

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
