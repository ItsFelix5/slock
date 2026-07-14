import "./Skeleton.css";

export interface SkeletonProps {
  circle?: boolean;
  height?: string | number;
  radius?: string | number;
  width?: string | number;
}

export default function Skeleton(props: SkeletonProps) {
  const toCss = (v: string | number | undefined, fallback: string) =>
    v === undefined ? fallback : typeof v === "number" ? `${v}px` : v;

  return (
    <div
      class="skeleton"
      style={{
        "border-radius": props.circle ? "50%" : toCss(props.radius, "4px"),
        height: toCss(props.height, "1em"),
        width: toCss(props.width, "100%"),
      }}
    />
  );
}
