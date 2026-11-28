import { service } from "@slock/core/solid";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import type { CanvasVersion, FileId } from "@slock/types";
import { createResetSignal } from "@slock/ui";
import { untrack } from "solid-js";
import { type CanvasMeta, type DiffEntry, diffNodes } from "../../protocol/api";
import type { CanvasDocModel } from "./canvasDelta";
import {
  fetchCanvasVersion,
  fetchCanvasVersions,
  type LoadedCanvas,
  restoreCanvasVersion,
} from "./canvasRequests";
import { olderVersion } from "./canvasVersions";

const feedback = service("feedback");

interface ViewingRef {
  fileId: FileId;
  meta: CanvasMeta;
  older: CanvasVersion | undefined;
  version: CanvasVersion;
}

const canvasVersions = defineQuery<FileId, CanvasVersion[]>({
  load: (fileId, { signal }) => fetchCanvasVersions(fileId, signal),
  name: "canvasVersions",
});

// One object, so a view can never pair one version's document with another's changes.
const canvasVersionView = defineQuery<
  ViewingRef,
  { diff: DiffEntry[]; doc: CanvasDocModel } | null
>({
  load: async ({ fileId, meta, older, version }, { signal }) => {
    const [doc, previous] = await Promise.all([
      fetchCanvasVersion(fileId, version, meta, signal),
      older ? fetchCanvasVersion(fileId, older, meta, signal) : null,
    ]);
    if (!doc || (older && !previous)) return null;
    // The diff also shows what was removed, so it needs the references of both versions.
    const embeds = new Map([...(previous?.embeds ?? []), ...doc.embeds]);
    return { diff: diffNodes(previous?.nodes ?? [], doc.nodes), doc: { ...doc, embeds } };
  },
  name: "canvasVersion",
  revalidates: false,
});

const versionRestore = defineMutation<{ fileId: FileId; version: CanvasVersion }>({
  key: ({ fileId }) => fileId,
  mode: "single",
  onError: (error, { fileId }) => feedback.caught(fileId, error, "Couldn't restore this version"),
  run: ({ fileId, version }) => restoreCanvasVersion(fileId, version),
});

export function createCanvasHistory(
  fileId: () => FileId,
  content: () => LoadedCanvas | null | undefined,
  reload: () => unknown,
) {
  const [open, setOpen] = createResetSignal(fileId, false);
  const [selected, setSelected] = createResetSignal<CanvasVersion | null>(fileId, null);
  const versions = canvasVersions.state(() => (open() || selected() ? fileId() : undefined));
  function viewingRef(): ViewingRef | undefined {
    const version = selected();
    const meta = content()?.doc?.meta;
    if (!(version && meta)) return;
    return {
      fileId: fileId(),
      meta,
      older: olderVersion(versions().data ?? [], version),
      version,
    };
  }
  const viewing = canvasVersionView.state(viewingRef);

  function close() {
    setOpen(false);
    setSelected(null);
  }

  async function restore(version: CanvasVersion) {
    if (!(await versionRestore.run({ fileId: fileId(), version }))) return;
    close();
    await reload();
  }

  function retry() {
    const ref = untrack(viewingRef);
    if (ref) void canvasVersionView.refresh(ref).catch(() => {});
  }

  return {
    close,
    failed: () => viewing().status === "error" || viewing().data === null,
    open,
    restore,
    retry,
    restoring: () => versionRestore.pending(fileId()),
    selected,
    setOpen,
    setSelected,
    versions,
    viewing,
  };
}
