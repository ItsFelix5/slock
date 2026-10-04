import "./Icon.css";
import ICONS from "./icons.json";

export function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  const pool: readonly string[] = options;
  return pool.includes(value);
}

export function objectKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj).filter((key): key is Extract<keyof T, string> => key in obj);
}

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = objectKeys(ICONS);

export default function Icon(props: { name: IconName; size?: number; class?: string }) {
  return (
    <span
      class={`icon ${props.class ?? ""}`}
      innerHTML={`<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${ICONS[props.name]}</svg>`}
      style={{ height: `${props.size ?? 18}px`, width: `${props.size ?? 18}px` }}
    />
  );
}
