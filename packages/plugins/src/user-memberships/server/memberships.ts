import { ifPresent, parseChannelId, parseUserId } from "@slock/slack";
import type { ChannelId, UserId } from "@slock/types";
import type { Credentials } from "../../slack/server/api/auth";
import { callSlack, type SlackReply } from "../../slack/server/api/slackClient";

type RawConversation = {
  id: string;
  name?: string;
  user?: string;
  creator?: string;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
};

type Page = { channels: RawConversation[]; response_metadata?: { next_cursor?: string } };

export type MembershipKind = "public" | "private" | "mpim" | "im";

export type Membership = {
  id: ChannelId;
  kind: MembershipKind;
  name: string;
  userId?: UserId;
  created: boolean;
};

const MAX_PAGES = 20;

function kindOf(conversation: RawConversation): MembershipKind {
  if (conversation.is_im) return "im";
  if (conversation.is_mpim) return "mpim";
  return conversation.is_private ? "private" : "public";
}

export async function listMemberships(
  userId: UserId,
  creds: Credentials | null,
): Promise<SlackReply<{ memberships: Membership[] }>> {
  const memberships: Membership[] = [];
  let cursor = "";
  for (let page = 0; page < MAX_PAGES; page++) {
    const reply = await callSlack<Page>(
      "users.conversations",
      {
        exclude_archived: "true",
        limit: "1000",
        types: "public_channel,private_channel,mpim,im",
        user: userId,
        ...(cursor && { cursor }),
      },
      creds,
    );
    if (!reply.ok) return reply;
    for (const conversation of reply.channels) {
      memberships.push({
        created: conversation.creator === userId,
        id: parseChannelId(conversation.id),
        kind: kindOf(conversation),
        name: conversation.name ?? "",
        userId: ifPresent(parseUserId, conversation.user),
      });
    }
    cursor = reply.response_metadata?.next_cursor ?? "";
    if (!cursor) break;
  }
  return { memberships, ok: true };
}
