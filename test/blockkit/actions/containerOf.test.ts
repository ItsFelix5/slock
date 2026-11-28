import { expect, test } from "bun:test";
import { containerOf } from "../../../packages/blockkit/src/actions/blockActions";
import { ch, stamp } from "../../support/slack";

const context = { channelId: ch("C1"), messageTs: stamp("1700000000.000100") };

test("describes a message block", () => {
  expect(containerOf(context)).toEqual({
    channel_id: context.channelId,
    is_ephemeral: false,
    message_ts: context.messageTs,
    type: "message",
  });
});

test("describes an attachment block", () => {
  expect(containerOf({ ...context, attachmentId: 2, isEphemeral: true })).toEqual({
    attachment_id: 2,
    channel_id: context.channelId,
    is_ephemeral: true,
    message_ts: context.messageTs,
    type: "message_attachment",
  });
});
