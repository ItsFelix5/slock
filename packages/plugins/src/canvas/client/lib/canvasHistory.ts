import { service } from "@slock/core/solid";
import type { CanvasVersion, FileId } from "@slock/types";
import { createEffect, createMemo, createSignal } from "solid-js";
import { defineQuery } from "../../../query/client/api";
import { type CanvasMeta, diffNodes } from "../../protocol/api";
import {
  fetchCanvasVersion,
  fetchCanvasVersions,
  type LoadedCanvas,
  restoreCanvasVersion,
} from "./canvasRequests";
import type { CanvasDocModel } from "./canvasDelta";
import { olderVersion } from "./canvasVersions";

const feedback = service("feedback");

interface ViewingRef {
  fileId: FileId;
  meta: CanvasMeta;
  older: CanvasVersion | undefined;
  version: CanvasVersion;
}

const canvasVersions = defineQuery<FileId, CanvasVersion[]>({
  load: fetchCanvasVersions,
  name: "canvasVersions",
});

const canvasVersionView = defineQuery<
  ViewingRef,
  { doc: CanvasDocModel; previous: CanvasDocModel | null } | null
>({
  load: async ({ fileId, meta, older, version }) => {
    const [doc, previous] = await Promise.all([
      fetchCanvasVersion(fileId, version, meta),
      older ? fetchCanvasVersion(fileId, older, meta) : null,
    ]);
    return doc ? { doc, previous } : null;
  },
  name: "canvasVersion",
});

export function createCanvasHistory(
  fileId: () => FileId,
  content: () => LoadedCanvas | null | undefined,
  reload: () => unknown,
) {
  const [open, setOpen] = createSignal(false);
  const [selected, setSelected] = createSignal<CanvasVersion | null>(null);
  const [restoring, setRestoring] = createSignal(false);
  const versions = canvasVersions.state(() => (open() || selected() ? fileId() : undefined));
  const viewing = canvasVersionView.state(() => {
    const version = selected();
    const meta = content()?.doc?.meta;
    if (!(version && meta)) return;
    return {
      fileId: fileId(),
      meta,
      older: olderVersion(versions().data ?? [], version),
      version,
    };
  });
  const diff = createMemo(() => {
    const view = viewing().data;
    return view ? diffNodes(view.previous?.nodes ?? [], view.doc.nodes) : undefined;
  });

  createEffect(fileId, () => {
    setOpen(false);
    setSelected(null);
  });

  function close() {
    setOpen(false);
    setSelected(null);
  }

  async function restore(version: CanvasVersion) {
    setRestoring(true);
    try {
      await restoreCanvasVersion(fileId(), version);
      close();
      await reload();
    } catch (error) {
      feedback.caught(fileId(), error, "Couldn't restore this version");
    } finally {
      setRestoring(false);
    }
  }

  return {
    close,
    diff,
    open,
    restore,
    restoring,
    selected,
    setOpen,
    setSelected,
    versions,
    viewing,
  };
}
