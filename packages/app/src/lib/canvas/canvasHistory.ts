import { diffNodes } from "@slock/canvas";
import type { CanvasVersion } from "@slock/types";
import { createEffect, createMemo, createResource, createSignal, on } from "solid-js";
import {
  fetchCanvasVersion,
  fetchCanvasVersions,
  type LoadedCanvas,
  restoreCanvasVersion,
} from "../api";
import { flashCaughtError } from "../feedback";

export function createCanvasHistory(
  fileId: () => string,
  content: () => LoadedCanvas | null | undefined,
  reload: () => unknown,
) {
  const [open, setOpen] = createSignal(false);
  const [selected, setSelected] = createSignal<CanvasVersion | null>(null);
  const [restoring, setRestoring] = createSignal(false);
  const [versions] = createResource(
    () => (open() || selected() ? fileId() : undefined),
    fetchCanvasVersions,
  );
  const [viewing] = createResource(
    () => {
      const version = selected();
      const meta = content()?.doc?.meta;
      const list = versions() ?? [];
      return version && meta ? { list, meta, version } : undefined;
    },
    async ({ list, meta, version }) => {
      const older = list[list.indexOf(version) + 1];
      const [doc, previous] = await Promise.all([
        fetchCanvasVersion(fileId(), version, meta),
        older ? fetchCanvasVersion(fileId(), older, meta) : null,
      ]);
      return doc ? { doc, previous } : null;
    },
  );
  const diff = createMemo(() => {
    const view = viewing();
    return view ? diffNodes(view.previous?.nodes ?? [], view.doc.nodes) : undefined;
  });

  createEffect(
    on(fileId, () => {
      setOpen(false);
      setSelected(null);
    }),
  );

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
      flashCaughtError(fileId(), error, "Couldn't restore this version");
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
