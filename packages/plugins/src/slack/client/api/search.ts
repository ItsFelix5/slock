import { canvasFileIdOf, parseChannelId } from "@slock/slack";
import type { BrowsableChannel, RawChannel } from "@slock/types";

export function mapBrowsableChannels(items: RawChannel[]): BrowsableChannel[] {
  return items
    .filter(
      (channel) =>
        !(
          channel.is_archived ||
          channel.is_member ||
          channel.is_private ||
          channel.is_mpim ||
          channel.is_im ||
          channel.is_record_channel ||
          canvasFileIdOf(channel) ||
          channel.name?.startsWith("mpdm-")
        ),
    )
    .map((channel) => ({
      id: parseChannelId(channel.id),
      memberCount: channel.member_count,
      name: channel.name ?? channel.id,
      private: !!channel.is_private,
      topic: typeof channel.topic === "string" ? channel.topic : (channel.topic?.value ?? ""),
    }));
}
