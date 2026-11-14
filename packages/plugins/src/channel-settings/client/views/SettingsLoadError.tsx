import { errorMessage } from "@slock/core";
import { Button } from "@slock/ui";
import { Show } from "solid-js";

export default function SettingsLoadError(props: {
  error: unknown;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div class="channel-details-settings-warning flex-between">
      <div>
        <div>{props.message}</div>
        <div class="channel-details-settings-error-code">
          {errorMessage(props.error, "Unknown error")}
        </div>
      </div>
      <Show when={props.onRetry}>
        {(onRetry) => (
          <Button onClick={onRetry()} size="sm">
            Try again
          </Button>
        )}
      </Show>
    </div>
  );
}
