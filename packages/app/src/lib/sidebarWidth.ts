import { createSignal } from "solid-js";

const [sidebarWidth, setSidebarWidth] = createSignal(260);

export { setSidebarWidth, sidebarWidth };
