import { expect, spyOn, test } from "bun:test";
import { createHost } from "@slock/core";
import { service, setHost, solidReactive } from "@slock/core/solid";
import { provideUi } from "@slock/ui";
import { render } from "@solidjs/web";
import { flush } from "solid-js";
import { createFakeEnv } from "../../../support/core";

async function mount(initial?: { ts: number; format: string }) {
  const host = createHost({ env: createFakeEnv(1, 1_700_000_000_000), reactive: solidReactive });
  setHost(host);
  await host.register({ id: "ui", setup: provideUi });
  service("env").now();
  const { default: DatePicker } = await import(
    "../../../../packages/plugins/src/dates/client/api/DatePicker"
  );
  const selected: [number, string][] = [];
  const root = document.createElement("div");
  document.body.append(root);
  const dispose = render(
    () => (
      <DatePicker
        initial={initial}
        onClose={() => {}}
        onSelect={(ts, format) => selected.push([ts, format])}
      />
    ),
    root,
  );
  flush();
  return {
    click: (label: string) => {
      const button = [...root.querySelectorAll("button")].find((b) => b.textContent === label);
      button?.click();
      flush();
    },
    dispose: () => {
      dispose();
      root.remove();
    },
    selected,
  };
}

test("editing an existing date reports each change but not the initial value", async () => {
  const warn = spyOn(console, "warn");
  const picker = await mount({ format: "{date_pretty} at {time}", ts: 1_700_000_000 });
  expect(picker.selected).toEqual([]);
  picker.click("No time");
  expect(picker.selected).toEqual([[1_700_000_000, "{date_pretty}"]]);
  picker.dispose();
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});

test("a new date is reported only when inserted", async () => {
  const picker = await mount();
  picker.click("No time");
  expect(picker.selected).toEqual([]);
  picker.dispose();
});
