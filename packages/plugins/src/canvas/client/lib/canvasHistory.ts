import { service } from "@slock/core/solid";
import type { CanvasVersion } from "@slock/types";
import { createEffect, createMemo, createSignal, on } from "solid-js";
import { createKeyedQuery, defineKey } from "../../../query/client/api";
import { diffNodes } from "../../protocol/api";
import {
  fetchCanvasVersion,
  fetchCanvasVersions,
  type LoadedCanvas,
  restoreCanvasVersion,
} from "./canvasRequests";

const feedback = service("feedback");
const versionsKey = defineKey<[string]>("canvasVersions");
const versionKey = defineKey<[string, string, string | null]>("canvasVersion");

export function createCanvasHistory(
  fileId: () => string,
  content: () => LoadedCanvas | null | undefined,
  reload: () => unknown,
) {
  const [open, setOpen] = createSignal(false);
  const [selected, setSelected] = createSignal<CanvasVersion | null>(null);
  const [restoring, setRestoring] = createSignal(false);
  const versions = createKeyedQuery(() =>
    open() || selected()
      ? { queryFn: () => fetchCanvasVersions(fileId()), queryKey: versionsKey(fileId()) }
      : undefined,
  );
  const viewing = createKeyedQuery(() => {
    const version = selected();
    const meta = content()?.doc?.meta;
    const list = versions.data ?? [];
    if (!(version && meta)) return;
    const older = list[list.indexOf(version) + 1];
    return {
      queryFn: async () => {
        const [doc, previous] = await Promise.all([
          fetchCanvasVersion(fileId(), version, meta),
          older ? fetchCanvasVersion(fileId(), older, meta) : null,
        ]);
        return doc ? { doc, previous } : null;
      },
      queryKey: versionKey(fileId(), version.versionId, older?.versionId ?? null),
    };
  });
  const diff = createMemo(() => {
    const view = viewing.data;
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
