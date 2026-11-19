import { Mrkdwn } from "@slock/blockkit";
import type { Block, SlackFile } from "@slock/types";
import { Icon } from "@slock/ui";
import { Show } from "solid-js";
import { fileSummaryIcon, fileSummaryLabel } from "./fileSummary";
import "./TextOrFiles.css";

export default function TextOrFiles(props: {
  blocks?: Block[];
  files?: SlackFile[];
  inline?: boolean;
  text: string;
}) {
  const filesOnly = () =>
    !(props.blocks?.length || props.text.trim()) && props.files?.length ? props.files : undefined;
  return (
    <Show fallback={<Mrkdwn inline={props.inline} text={props.text} />} when={filesOnly()}>
      {(files) => (
        <span class="text-or-files">
          <Icon name={fileSummaryIcon(files())} size={12} />
          {fileSummaryLabel(files())}
        </span>
      )}
    </Show>
  );
}
