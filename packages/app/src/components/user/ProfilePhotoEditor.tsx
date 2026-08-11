import { Button, Modal, ModalHeader } from "@slock/ui";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import "./ProfilePhotoEditor.css";

type Crop = { size: number; x: number; y: number };
type Drag =
  | { kind: "move"; offsetX: number; offsetY: number }
  | { anchorX: number; anchorY: number; directionX: -1 | 1; directionY: -1 | 1; kind: "resize" };

export interface ProfilePhotoEditorProps {
  file: File;
  onClose: () => void;
  onSave: (file: File) => Promise<boolean>;
}

function initialCrop(width: number, height: number): Crop {
  const size = Math.min(width, height);
  return { size, x: (width - size) / 2, y: (height - size) / 2 };
}

function outputName(name: string) {
  const dot = name.lastIndexOf(".");
  return `${dot > 0 ? name.slice(0, dot) : name}-profile.png`;
}

export default function ProfilePhotoEditor(props: ProfilePhotoEditorProps) {
  const [imageUrl] = createSignal(URL.createObjectURL(props.file));
  const [dimensions, setDimensions] = createSignal<{ height: number; width: number }>();
  const [crop, setCrop] = createSignal<Crop>();
  const [drag, setDrag] = createSignal<Drag>();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [stageRef, setStageRef] = createSignal<HTMLDivElement>();
  const [imageRef, setImageRef] = createSignal<HTMLImageElement>();
  onCleanup(() => URL.revokeObjectURL(imageUrl()));

  const sourceFrame = createMemo(() => {
    const source = dimensions();
    if (!source) return;
    const ratio = source.width / source.height;
    return ratio >= 1
      ? { height: 1 / ratio, width: 1, x: 0, y: (1 - 1 / ratio) / 2 }
      : { height: 1, width: ratio, x: (1 - ratio) / 2, y: 0 };
  });
  const cropStyle = createMemo(() => {
    const frame = sourceFrame();
    const source = dimensions();
    const value = crop();
    if (!(frame && source && value)) return {};
    return {
      height: `${(value.size / source.height) * frame.height * 100}%`,
      left: `${(frame.x + (value.x / source.width) * frame.width) * 100}%`,
      top: `${(frame.y + (value.y / source.height) * frame.height) * 100}%`,
      width: `${(value.size / source.width) * frame.width * 100}%`,
    };
  });

  function sourcePoint(event: PointerEvent) {
    const stage = stageRef()?.getBoundingClientRect();
    const frame = sourceFrame();
    const source = dimensions();
    if (!(stage && frame && source)) return;
    return {
      x: ((event.clientX - stage.left) / stage.width - frame.x) * (source.width / frame.width),
      y: ((event.clientY - stage.top) / stage.height - frame.y) * (source.height / frame.height),
    };
  }

  function constrainCrop(value: Crop): Crop | undefined {
    const source = dimensions();
    if (!source) return;
    const minSize = Math.min(64, source.width, source.height);
    const size = Math.max(
      minSize,
      Math.min(value.size, Math.max(source.width, source.height) * 1.6),
    );
    const snapDistance = Math.min(source.width, source.height) * 0.04;
    let x = Math.max(-size * 0.18, Math.min(value.x, source.width - size * 0.82));
    let y = Math.max(-size * 0.18, Math.min(value.y, source.height - size * 0.82));
    if (Math.abs(x) < snapDistance) x = 0;
    if (Math.abs(y) < snapDistance) y = 0;
    if (Math.abs(x + size - source.width) < snapDistance) x = source.width - size;
    if (Math.abs(y + size - source.height) < snapDistance) y = source.height - size;
    return {
      size,
      x,
      y,
    };
  }

  function startMove(event: PointerEvent) {
    const point = sourcePoint(event);
    const value = crop();
    if (!(point && value)) return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: "move", offsetX: point.x - value.x, offsetY: point.y - value.y });
  }

  function startResize(event: PointerEvent, directionX: -1 | 1, directionY: -1 | 1) {
    const value = crop();
    if (!value) return;
    event.preventDefault();
    event.stopPropagation();
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      anchorX: directionX === -1 ? value.x + value.size : value.x,
      anchorY: directionY === -1 ? value.y + value.size : value.y,
      directionX,
      directionY,
      kind: "resize",
    });
  }

  function moveCrop(event: PointerEvent) {
    const point = sourcePoint(event);
    const active = drag();
    const value = crop();
    if (!(point && active && value)) return;
    if (active.kind === "move") {
      const next = constrainCrop({
        ...value,
        x: point.x - active.offsetX,
        y: point.y - active.offsetY,
      });
      if (next) setCrop(next);
      return;
    }
    const size = Math.max(Math.abs(point.x - active.anchorX), Math.abs(point.y - active.anchorY));
    const next = constrainCrop({
      size,
      x: active.directionX === -1 ? active.anchorX - size : active.anchorX,
      y: active.directionY === -1 ? active.anchorY - size : active.anchorY,
    });
    if (next) setCrop(next);
  }

  async function save() {
    const source = dimensions();
    const value = crop();
    const image = imageRef();
    if (!(source && value && image)) return;
    setSaving(true);
    setError(undefined);
    try {
      const canvas = document.createElement("canvas");
      const outputSize = 512;
      canvas.height = outputSize;
      canvas.width = outputSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Couldn’t prepare this image.");
      const left = Math.max(0, value.x);
      const top = Math.max(0, value.y);
      const right = Math.min(source.width, value.x + value.size);
      const bottom = Math.min(source.height, value.y + value.size);
      if (right > left && bottom > top) {
        const scale = outputSize / value.size;
        context.drawImage(
          image,
          left,
          top,
          right - left,
          bottom - top,
          (left - value.x) * scale,
          (top - value.y) * scale,
          (right - left) * scale,
          (bottom - top) * scale,
        );
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Couldn’t crop image."))),
          "image/png",
        ),
      );
      if (
        await props.onSave(new File([blob], outputName(props.file.name), { type: "image/png" }))
      ) {
        props.onClose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t crop image.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      ariaLabel="Edit profile photo"
      class="profile-photo-editor"
      onClose={() => !saving() && props.onClose()}
    >
      <ModalHeader onClose={() => !saving() && props.onClose()} title="Edit profile photo" />
      <div class="profile-photo-editor-content">
        <div
          class="profile-photo-editor-stage"
          onPointerMove={moveCrop}
          onPointerUp={() => setDrag(undefined)}
          ref={setStageRef}
        >
          <img
            alt=""
            class="profile-photo-editor-image"
            onError={() => setError("This image couldn’t be opened.")}
            onLoad={(event) => {
              const { naturalHeight: height, naturalWidth: width } = event.currentTarget;
              setDimensions({ height, width });
              setCrop(initialCrop(width, height));
            }}
            ref={setImageRef}
            src={imageUrl()}
          />
          <Show when={crop()}>
            <div class="profile-photo-editor-crop" onPointerDown={startMove} style={cropStyle()}>
              <button
                aria-label="Resize crop from top left"
                class="profile-photo-editor-dot top-left"
                onPointerDown={(event) => startResize(event, -1, -1)}
                type="button"
              />
              <button
                aria-label="Resize crop from top right"
                class="profile-photo-editor-dot top-right"
                onPointerDown={(event) => startResize(event, 1, -1)}
                type="button"
              />
              <button
                aria-label="Resize crop from bottom right"
                class="profile-photo-editor-dot bottom-right"
                onPointerDown={(event) => startResize(event, 1, 1)}
                type="button"
              />
              <button
                aria-label="Resize crop from bottom left"
                class="profile-photo-editor-dot bottom-left"
                onPointerDown={(event) => startResize(event, -1, 1)}
                type="button"
              />
            </div>
          </Show>
        </div>
        <Show when={error()}>
          {(message) => <p class="profile-photo-editor-error">{message()}</p>}
        </Show>
      </div>
      <div class="profile-photo-editor-actions flex-between">
        <Button disabled={saving()} onClick={props.onClose} variant="secondary">
          Cancel
        </Button>
        <Button disabled={saving() || !crop()} onClick={() => void save()} variant="primary">
          {saving() ? "Saving…" : "Save photo"}
        </Button>
      </div>
    </Modal>
  );
}
