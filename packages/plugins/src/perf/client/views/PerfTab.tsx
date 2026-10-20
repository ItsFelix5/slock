import { service } from "@slock/core/solid";
import { Button, createCopyFeedback } from "@slock/ui";
import { createSignal } from "solid-js";

const perf = service("perf");

export default function PerfTab() {
  const [stats, setStats] = createSignal(perf.stats());
  const [copied, copy] = createCopyFeedback();

  return (
    <>
      <h2>Performance</h2>
      <div class="settings-row flex-between">
        <div class="settings-row-label">
          {stats().frames} slow frames, {stats().interactions} slow interactions
        </div>
        <div class="flex-align-center">
          <Button
            onClick={() => {
              perf.clear();
              setStats(perf.stats());
            }}
          >
            Clear
          </Button>
          <Button
            autofocus
            onClick={() => {
              setStats(perf.stats());
              void copy(perf.report(), "report");
            }}
            variant="primary"
          >
            {copied() ? "Copied" : "Copy report"}
          </Button>
        </div>
      </div>
    </>
  );
}
