import { Button, confirmDialog } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import {
  archiveChannelById,
  convertChannelToPrivateById,
  unarchiveChannelById,
} from "../lib/channelDetails";

export default function ChannelDangerZone(props: {
  archived: boolean;
  channelId: string;
  onChanged?: () => void;
  private: boolean;
}) {
  const [archiving, setArchiving] = createSignal(false);
  const toggleArchived = async () => {
    if (archiving()) return;
    const verb = props.archived ? "Unarchive" : "Archive";

    const confirmed = await confirmDialog({ confirmLabel: verb, message: `${verb} this channel?` });
    if (!confirmed) return;
    setArchiving(true);
    const ok = await (props.archived
      ? unarchiveChannelById(props.channelId)
      : archiveChannelById(props.channelId));
    setArchiving(false);
    if (ok) props.onChanged?.();
  };

  const [convertingPrivate, setConvertingPrivate] = createSignal(false);
  const convertToPrivate = async () => {
    if (convertingPrivate()) return;

    const confirmed = await confirmDialog({
      confirmLabel: "Convert",
      danger: true,
      message: "Convert this channel to private? This can't be undone.",
    });
    if (!confirmed) return;
    setConvertingPrivate(true);
    const ok = await convertChannelToPrivateById(props.channelId);
    setConvertingPrivate(false);
    if (ok) props.onChanged?.();
  };

  return (
    <div class="settings-section">
      <div class="settings-row-label">Danger zone</div>
      <Show when={!props.private}>
        <div class="settings-row flex-between">
          <div class="settings-row-label">Convert to a private channel</div>
          <Button disabled={convertingPrivate()} onClick={convertToPrivate} variant="danger">
            {convertingPrivate() ? "Converting…" : "Convert to private"}
          </Button>
        </div>
      </Show>
      <div class="settings-row flex-between">
        <div class="settings-row-label">
          {props.archived ? "Unarchive this channel" : "Archive this channel"}
        </div>
        <Button disabled={archiving()} onClick={toggleArchived} variant="danger">
          {archiving() ? "Working…" : props.archived ? "Unarchive" : "Archive channel"}
        </Button>
      </div>
    </div>
  );
}
