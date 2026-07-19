import { createContext } from "solid-js";

// A Menu/ContextMenu nested inside another one's panel is portaled to
// document.body independently, so it lands as a DOM sibling of the outer
// panel rather than a descendant — useClickOutside then sees a click inside
// the nested panel as "outside" the outer one and closes it before the click
// even fires. Each panel provides its own element here so a nested
// FloatingPanel can portal into it instead of body, keeping DOM nesting in
// sync with component nesting.
export const FloatingMountContext = createContext<() => Element | undefined>();
