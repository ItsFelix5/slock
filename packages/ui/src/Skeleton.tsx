import "./Skeleton.css";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  circle?: boolean;
}

export default function Skeleton(props: SkeletonProps) {
  const toCss = (v: string | number | undefined, fallback: string) =>
    v === undefined ? fallback : typeof v === "number" ? `${v}px` : v;

  return (
    <div
      class="skeleton"
      style={{
        width: toCss(props.width, "100%"),
        height: toCss(props.height, "1em"),
        "border-radius": props.circle ? "50%" : toCss(props.radius, "4px"),
      }}
    />
  );
}
