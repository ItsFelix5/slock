import type { FileBlock } from "@slock/types";

export default function File(props: { block: FileBlock }) {
  return (
    <div class="bk-file" title={props.block.external_id}>
      Remote file shared from Slack
    </div>
  );
}
