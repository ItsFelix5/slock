import { errorMessage } from "@slock/core";
import { Button, Modal, ModalHeader } from "@slock/ui";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import {
  type Corner,
  type Crop,
  constrainCrop,
  cornerAnchor,
  cropDrawRect,
  type Dimensions,
  initialCrop,
  nudgeCrop,
  profilePhotoName,
  resizeFromAnchor,
} from "./photoCrop";
import "./ProfilePhotoEditor.css";

type Drag =
  | { kind: "move"; offsetX: number; offsetY: number }
  | { anchor: { x: number; y: number }; corner: Corner; kind: "resize" };

const OUTPUT_SIZE = 512;

interface ProfilePhotoEditorProps {
  file: File;
  onClose: () => void;
  onSave: (file: File) => Promise<boolean>;
}

export default function ProfilePhotoEditor(props: ProfilePhotoEditorProps) {
  const [imageUrl] = createSignal(URL.createObjectURL(props.file));
  const [dimensions, setDimensions] = createSignal<Dimensions>();
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

  function startMove(event: PointerEvent) {
    const point = sourcePoint(event);
    const value = crop();
    if (!(point && value)) return;
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ kind: "move", offsetX: point.x - value.x, offsetY: point.y - value.y });
  }

  function startResize(event: PointerEvent, corner: Corner) {
    const value = crop();
    if (!value) return;
    event.preventDefault();
    event.stopPropagation();
    if (!(event.currentTarget instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ anchor: cornerAnchor(value, corner), corner, kind: "resize" });
  }

  function moveCrop(event: PointerEvent) {
    const point = sourcePoint(event);
    const active = drag();
    const value = crop();
    const source = dimensions();
    if (!(point && active && value && source)) return;
    if (active.kind === "move") {
      setCrop(
        constrainCrop(
          { ...value, x: point.x - active.offsetX, y: point.y - active.offsetY },
          source,
        ),
      );
      return;
    }
    setCrop(constrainCrop(resizeFromAnchor(active.anchor, active.corner, point), source));
  }

  function onCropKeyDown(event: KeyboardEvent) {
    const value = crop();
    const source = dimensions();
    if (!(value && source)) return;
    const next = nudgeCrop(value, event.key, event.shiftKey, source);
    if (!next) return;
    event.preventDefault();
    setCrop(next);
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
      canvas.height = OUTPUT_SIZE;
      canvas.width = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Couldn't prepare this image.");
      const rect = cropDrawRect(value, source, OUTPUT_SIZE);
      if (rect)
        context.drawImage(
          image,
          rect.sourceX,
          rect.sourceY,
          rect.sourceWidth,
          rect.sourceHeight,
          rect.destX,
          rect.destY,
          rect.destWidth,
          rect.destHeight,
        );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("Couldn't crop image."))),
          "image/png",
        ),
      );
      if (
        await props.onSave(
          new File([blob], profilePhotoName(props.file.name), { type: "image/png" }),
        )
      ) {
        props.onClose();
      }
    } catch (cause) {
      setError(errorMessage(cause, "Couldn't crop image."));
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
          onPointerCancel={() => setDrag(undefined)}
          onPointerUp={() => setDrag(undefined)}
          ref={setStageRef}
        >
          <img
            alt=""
            class="profile-photo-editor-image fill"
            onError={() => setError("This image couldn't be opened.")}
            onLoad={(event) => {
              const { naturalHeight: height, naturalWidth: width } = event.currentTarget;
              const natural = { height, width };
              setDimensions(natural);
              setCrop(initialCrop(natural));
            }}
            ref={setImageRef}
            src={imageUrl()}
          />
          <Show when={crop()}>
            <div
              aria-label="Crop"
              class="profile-photo-editor-crop"
              onKeyDown={onCropKeyDown}
              onPointerDown={startMove}
              style={cropStyle()}
              tabindex="0"
            >
              <span
                aria-hidden="true"
                class="profile-photo-editor-dot top-left"
                onPointerDown={(event) => startResize(event, { x: -1, y: -1 })}
              />
              <span
                aria-hidden="true"
                class="profile-photo-editor-dot top-right"
                onPointerDown={(event) => startResize(event, { x: 1, y: -1 })}
              />
              <span
                aria-hidden="true"
                class="profile-photo-editor-dot bottom-right"
                onPointerDown={(event) => startResize(event, { x: 1, y: 1 })}
              />
              <span
                aria-hidden="true"
                class="profile-photo-editor-dot bottom-left"
                onPointerDown={(event) => startResize(event, { x: -1, y: 1 })}
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
