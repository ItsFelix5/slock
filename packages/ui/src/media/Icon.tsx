import "./Icon.css";
import { ICONS_1 } from "./icons/icons-1";
import { ICONS_2 } from "./icons/icons-2";
import { ICONS_3 } from "./icons/icons-3";

const ICONS = { ...ICONS_1, ...ICONS_2, ...ICONS_3 };

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export default function Icon(props: { name: IconName; size?: number; class?: string }) {
  return (
    <span
      class={`icon ${props.class ?? ""}`}
      style={{
        width: `${props.size ?? 18}px`,
        height: `${props.size ?? 18}px`,
      }}
      innerHTML={`<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${ICONS[props.name]}</svg>`}
    />
  );
}
