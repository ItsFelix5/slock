import { Slot, service } from "@slock/core/solid";
import { Button } from "@slock/ui";
import "./BootstrapError.css";

const bootstrapStore = service("bootstrap");

export default function BootstrapError() {
  return (
    <main class="bootstrap-error flex-center flex-col">
      <h1>Couldn't load your workspace</h1>
      <p>Check your connection and try again or log in again.</p>
      <div class="flex-center bootstrap-error-actions">
        <Button
          disabled={bootstrapStore.bootstrap.isFetching}
          onClick={() => void bootstrapStore.retryBootstrap()}
          variant="primary"
        >
          {bootstrapStore.bootstrap.isFetching ? "Retrying…" : "Try again"}
        </Button>
        <Slot point="bootstrap.error.action" />
      </div>
    </main>
  );
}
