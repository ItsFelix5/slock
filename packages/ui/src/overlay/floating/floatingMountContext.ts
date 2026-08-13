import { createContext } from "solid-js";

export const FloatingMountContext = createContext<() => Element | undefined>();
