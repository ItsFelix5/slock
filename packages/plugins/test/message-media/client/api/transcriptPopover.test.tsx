import { afterEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv } from "@slock/core/testing";
import { fid } from "@slock/slack/testing";
import type { SlackFile } from "@slock/types";
import { provideUi } from "@slock/ui";
import { render } from "@solidjs/web";
import { flush } from "solid-js";
import TranscriptPopover from "../../../../src/message-media/client/api/TranscriptPopover";
import querySetup from "../../../../src/query/client/index";

const file: SlackFile = {
  id: fid("F1"),
  isImage: false,
  name: "voice.m4a",
  transcriptionLines: [
    { endMs: 1000, startMs: 0, text: "first" },
    { endMs: 5000, startMs: 1000, text: "second" },
  ],
  urlPrivate: "https://files.invalid/voice.m4a",
};

let teardown: (() => void) | undefined;
afterEach(() => {
  teardown?.();
  document.body.innerHTML = "";
});

async function mount(media: HTMLMediaElement) {
  const host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register({ id: "ui", setup: provideUi }, { id: "query", setup: querySetup });
  const dispose = render(
    () => <TranscriptPopover file={file} media={() => media} />,
    document.body,
  );
  teardown = () => {
    dispose();
    host.stop();
  };
  flush();
}

describe("TranscriptPopover", () => {
  test("opening highlights the line at the media position without waiting for a timeupdate", async () => {
    const media = document.createElement("audio");
    media.currentTime = 2;
    await mount(media);
    document.body.querySelector("button")?.click();
    flush();
    const active = [...document.querySelectorAll('[data-active="true"]')];
    expect(active.map((line) => line.textContent)).toEqual([expect.stringContaining("second")]);
  });
});
