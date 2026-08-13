import "./Icon.css";
import ICONS from "./icons.json";

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function createIconElement(name: IconName, size = 18, className = ""): HTMLSpanElement {
  const icon = document.createElement("span");
  icon.className = `icon ${className}`;
  icon.innerHTML = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${ICONS[name]}</svg>`;
  icon.style.height = `${size}px`;
  icon.style.width = `${size}px`;
  return icon;
}

export default function Icon(props: { name: IconName; size?: number; class?: string }) {
  return createIconElement(props.name, props.size, props.class);
}
