import "./Icon.css";
import ICONS from "./icons.json";

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
