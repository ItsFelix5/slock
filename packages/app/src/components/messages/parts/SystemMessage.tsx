import { Mrkdwn } from "@slock/blockkit";
import "./SystemMessage.css";

export default function SystemMessage(props: { text: string; time: string }) {
  return (
    <div class="system-message">
      <span class="system-message-text">
        <Mrkdwn text={props.text} />
      </span>
      <span class="system-message-time">{props.time}</span>
    </div>
  );
}
