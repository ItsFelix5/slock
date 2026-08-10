import { createSignal } from "solid-js";

// The hover action toolbar (react/reply/save/more) floats absolutely over
// the top-right corner of a message row, so it paints above the row's own
// meta line (name, timestamp, pronouns). Once a row is hovered its buttons
// become pointer-events:auto, which is fine for clicking them — but if a
// drag-to-select-text gesture starts on nearby text (e.g. the pronouns) and
// crosses that overlapping button area, the browser's native selection
// tracking gets interrupted by hitting a non-text element mid-drag, often
// leaving the selection anchored somewhere above the message instead.
// Suppressing pointer-events on the toolbar for the duration of any drag
// that didn't start on a button lets the text-selection gesture pass
// straight through it.
const DRAG_SELECTING_CLASS = "is-drag-selecting";
const HOVER_ACTIONS_SELECTOR = ".message-hover-actions";

const [isDragSelecting, setIsDragSelecting] = createSignal(false);

// A plain click is also a mousedown+mouseup, so the guard can't engage until
// the pointer has actually moved — otherwise every click on a message (to
// place a caret, click a link, whatever) would trip the guard and hide the
// hover toolbar for no reason.
const DRAG_MOVE_THRESHOLD = 4;

let downPos: { x: number; y: number } | null = null;
let downOnActions = false;

function onMouseDown(e: MouseEvent) {
  const target = e.target instanceof Element ? e.target : null;
  downPos = { x: e.clientX, y: e.clientY };
  downOnActions = !!target?.closest(HOVER_ACTIONS_SELECTOR);
}

function onMouseMove(e: MouseEvent) {
  if (!downPos || isDragSelecting()) return;
  const dx = e.clientX - downPos.x;
  const dy = e.clientY - downPos.y;
  if (Math.hypot(dx, dy) < DRAG_MOVE_THRESHOLD) return;
  setIsDragSelecting(true);
  if (!downOnActions) document.body.classList.add(DRAG_SELECTING_CLASS);
}

function onMouseUp() {
  downPos = null;
  document.body.classList.remove(DRAG_SELECTING_CLASS);
  setIsDragSelecting(false);
}

export function installMessageHoverDragGuard() {
  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  return () => {
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.classList.remove(DRAG_SELECTING_CLASS);
    setIsDragSelecting(false);
  };
}
