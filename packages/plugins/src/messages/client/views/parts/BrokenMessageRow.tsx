import type { Ts } from "@slock/types";

export default function BrokenMessageRow(props: { ts: Ts }) {
  return (
    <div class="message-row-group">
      <div class="message-row" data-message-ts={props.ts} tabindex={-1}>
        <div class="message-avatar-spacer" />
        <div class="message-body text-dim">Can't show this message</div>
      </div>
    </div>
  );
}
