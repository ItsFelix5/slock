import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { IconButton } from "@slock/ui";
import { createSignal } from "solid-js";
import { reportChannelNamesToFlaron } from "./report";

const setup: Setup = (ctx) => {
  const channels = service("channels");

  function ReportRow() {
    const [reporting, setReporting] = createSignal(false);
    const [reported, setReported] = createSignal(false);

    async function report() {
      setReporting(true);
      try {
        await reportChannelNamesToFlaron(
          channels
            .channels()
            .filter((channel) => channel.private)
            .map((channel) => channel.name),
        );
        setReported(true);
      } finally {
        setReporting(false);
      }
    }

    return (
      <div class="settings-row flex-between">
        <div class="settings-row-label">Send private channels to Flaron</div>
        <IconButton
          disabled={reporting()}
          icon="cloud-upload"
          label={
            reporting()
              ? "Sending…"
              : reported()
                ? "Sent to Flaron"
                : "Send private channel names to Flaron"
          }
          onClick={report}
          size="sm"
        />
      </div>
    );
  }

  ctx.add("account.section", ReportRow, { order: 20 });
};

export default setup;
