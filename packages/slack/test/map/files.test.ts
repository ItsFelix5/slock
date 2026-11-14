import { describe, expect, test } from "bun:test";
import { forAll } from "@slock/core/testing";
import type { RawAttachment, RawFile } from "@slock/types";
import { mapAttachment, mapFile, mapFileShare, mapLink } from "../../src/map/files";
import { ATTACHMENT_SPEC, FILE_SPEC, garbageRecord, viaJson } from "../../src/map/garbage";

describe("mapFile", () => {
  test("keeps the id and picks the largest thumbnail with dimensions", () => {
    const file = mapFile({
      created: 1,
      id: "F1",
      mimetype: "image/png",
      thumb_360: "small.png",
      thumb_360_h: 36,
      thumb_360_w: 64,
      thumb_800: "big.png",
      thumb_800_h: 80,
      thumb_800_w: 128,
    });
    expect(file).toMatchObject({
      height: 80,
      id: "F1",
      isImage: true,
      thumbUrl: "big.png",
      width: 128,
    });
  });

  test("falls back to url_private for images without thumbnails", () => {
    const file = mapFile({
      created: 1,
      id: "F1",
      mimetype: "image/gif",
      url_private: "https://x/y.gif",
    });
    expect(file.thumbUrl).toBe("https://x/y.gif");
  });

  test("derives the mimetype from the file extension", () => {
    expect(mapFile({ created: 1, id: "F1", name: "clip.MP4" }).isVideo).toBe(true);
    expect(mapFile({ created: 1, id: "F1", name: "clip.mp4" }).isVideo).toBe(true);
    expect(mapFile({ created: 1, id: "F1", name: "voice.m4a" }).isAudio).toBe(true);
  });

  test("a name without a dot is not an extension", () => {
    expect(mapFile({ created: 1, id: "F1", name: "mp3" })).toMatchObject({
      filetype: undefined,
      isAudio: false,
    });
  });

  test.each([
    "constructor",
    "toString",
    "__proto__",
    "hasOwnProperty",
  ])("extension %s does not hit Object.prototype", (extension) => {
    const file = mapFile({ created: 1, id: "F1", name: `a.${extension}` });
    expect(file.mimetype).toBeUndefined();
    expect(file.isImage).toBe(false);
  });

  test("audio waveform marks the file as audio and never video", () => {
    const file = mapFile({
      audio_wave_samples: [1, 2],
      created: 1,
      id: "F1",
      mimetype: "video/mp4",
    });
    expect(file).toMatchObject({ isAudio: true, isVideo: false, waveform: [1, 2] });
  });

  test("tombstones and files without created are deleted", () => {
    expect(mapFile({ created: 5, id: "F1", mode: "tombstone" }).isDeleted).toBe(true);
    expect(mapFile({ id: "F1" }).isDeleted).toBe(true);
    expect(mapFile({ created: 5, id: "F1" }).isDeleted).toBe(false);
  });

  test("duration_ms converts to seconds and duration wins", () => {
    expect(mapFile({ created: 1, duration_ms: 2500, id: "F1" }).duration).toBe(2.5);
    expect(mapFile({ created: 1, duration: 9, duration_ms: 2500, id: "F1" }).duration).toBe(9);
  });

  test("never throws on garbage and preserves the id", () => {
    forAll(
      (random) => ({ ...garbageRecord(random, FILE_SPEC), id: "F9" }),
      (garbage) => {
        expect(mapFile(viaJson<RawFile>(garbage)).id).toBe("F9");
      },
      500,
    );
  });
});

describe("mapAttachment", () => {
  test("keeps only named button actions with text", () => {
    const attachment = mapAttachment({
      actions: [
        { name: "ok", text: "OK", type: "button" },
        { name: "menu", text: "Menu", type: "select" },
        { text: "No name", type: "button" },
      ],
    });
    expect(attachment.actions?.map((action) => action.name)).toEqual(["ok"]);
  });

  test("empty urls become undefined and unfurl flags merge", () => {
    const attachment = mapAttachment({ image_url: "", is_reply_unfurl: true, video_url: "" });
    expect(attachment).toMatchObject({
      imageUrl: undefined,
      isMessageUnfurl: true,
      videoUrl: undefined,
    });
  });

  test("never throws on garbage", () => {
    forAll(
      (random) => garbageRecord(random, ATTACHMENT_SPEC),
      (garbage) => {
        mapAttachment(viaJson<RawAttachment>(garbage));
      },
      500,
    );
  });
});

describe("link and share", () => {
  test("mapLink drops null thumbnails", () => {
    const link = mapLink({
      icon_url: null,
      thumb_height: null,
      timestamp: "1",
      title: null,
      url: "u",
    });
    expect(link).toEqual({
      iconUrl: undefined,
      thumbHeight: undefined,
      thumbUrl: undefined,
      thumbWidth: undefined,
      title: null,
      ts: "1",
      url: "u",
    });
  });

  test("mapFileShare falls back to the channel id for the name", () => {
    expect(mapFileShare({ channel_id: "C1", ts: "1" }).channelName).toBe("C1");
  });
});

describe("voice clips", () => {
  const voiceClip = {
    audio_wave_samples: [0, 12, 40, 80, 31, 5],
    created: 1700000000,
    duration_ms: 4200,
    filetype: "webm",
    id: "F0VOICE",
    mimetype: "video/webm",
    mode: "hosted",
    name: "audio_message.webm",
    subtype: "slack_audio",
    url_private: "https://files.slack.com/files-pri/T1-F0VOICE/audio_message.webm",
  };

  test("webm with waveform samples is audio, not video", () => {
    const file = mapFile(viaJson<RawFile>(voiceClip));
    expect(file).toMatchObject({
      duration: 4.2,
      isAudio: true,
      isImage: false,
      isVideo: false,
      waveform: [0, 12, 40, 80, 31, 5],
    });
  });

  test("the same container without samples stays video", () => {
    const { audio_wave_samples: _samples, ...plain } = voiceClip;
    expect(mapFile(viaJson<RawFile>(plain))).toMatchObject({ isAudio: false, isVideo: true });
  });

  test("an empty waveform still marks audio", () => {
    expect(mapFile(viaJson<RawFile>({ ...voiceClip, audio_wave_samples: [] })).isVideo).toBe(false);
  });
});
