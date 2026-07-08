import "./ResizeHandle.css";

export default function ResizeHandle(props: {
  width: () => number;
  setWidth: (w: number) => void;
  min: number;
  max: number;
  /** 1 if dragging right should grow the panel (handle on its right edge), -1 if it should shrink it (handle on its left edge). */
  direction: 1 | -1;
  side: "left" | "right";
}) {
  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = props.width();

    const onMove = (ev: PointerEvent) => {
      const delta = (ev.clientX - startX) * props.direction;
      props.setWidth(Math.min(props.max, Math.max(props.min, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div class="resize-handle" classList={{ [props.side]: true }} onPointerDown={onPointerDown} />
  );
}
