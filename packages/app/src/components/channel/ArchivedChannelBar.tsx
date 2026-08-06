import { Icon } from "@slock/ui";
import "./JoinChannelBar.css";

export default function ArchivedChannelBar() {
  return (
    <div class="channel-notice-bar flex-align-center">
      <Icon name="archive" size={14} />
      <div class="channel-notice-bar-text">
        This channel has been archived. You can still view its history, but new messages can't be
        sent.
      </div>
    </div>
  );
}
