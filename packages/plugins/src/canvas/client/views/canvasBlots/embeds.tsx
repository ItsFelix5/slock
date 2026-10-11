import { mapFile } from "@slock/slack";
import type { RawFile } from "@slock/types";
import { Show } from "solid-js";
import MessageFiles from "../../../../message-media/client/api/MessageFiles";
import type {
  ColumnsEmbedValue,
  FileEmbedValue,
  ImageEmbedValue,
  TableEmbedValue,
} from "../../lib/canvasEmbedValues";
import { COLUMNS_EMBED, FILE_EMBED, IMAGE_EMBED, TABLE_EMBED } from "../../lib/canvasEmbedValues";
import CanvasColumnsView from "./CanvasColumnsView";
import CanvasTableView from "./CanvasTableView";
import { defineCanvasEmbed } from "./defineCanvasEmbed";

function CanvasFileView(props: { file: RawFile | null }) {
  return (
    <Show
      fallback={<div class="canvas-file-missing text-dim">This file is no longer available.</div>}
      when={props.file}
    >
      {(file) => <MessageFiles files={[mapFile(file())]} />}
    </Show>
  );
}

defineCanvasEmbed<ColumnsEmbedValue>({
  className: "canvas-columns-embed",
  name: COLUMNS_EMBED,
  view: CanvasColumnsView,
});

defineCanvasEmbed<TableEmbedValue>({
  className: "canvas-table-embed",
  name: TABLE_EMBED,
  view: CanvasTableView,
});

defineCanvasEmbed<ImageEmbedValue>({
  className: "canvas-image-embed",
  name: IMAGE_EMBED,
  view: (props) => {
    props.bind(() => props.value);
    return <CanvasFileView file={props.value.file} />;
  },
});

defineCanvasEmbed<FileEmbedValue>({
  className: "canvas-file-embed",
  name: FILE_EMBED,
  view: (props) => {
    props.bind(() => props.value);
    return <CanvasFileView file={props.value.file} />;
  },
});
