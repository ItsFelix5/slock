import type { MarkdownBlock } from "@slock/slack-api";
import Mrkdwn from "../mrkdwn";

export default function Markdown(props: { block: MarkdownBlock }) {
  return (
    <div class="bk-markdown">
      <Mrkdwn text={props.block.text} />
    </div>
  );
}
