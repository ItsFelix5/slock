export type TrayHandlers = { open(): void; quit(): void; lost(): void };

export type Tray = { close(): void };

export const TRAY_TITLE = "Slock";

export const TRAY_ITEMS = ["Open", "Quit"] as const;
