import { annotationQuote, quoteMrkdwn } from "./annotationQuote.ts";
import { readCanvas } from "./document.ts";
import { asMessage, asString, field, type RawMessage } from "./protobufRaw.ts";
import { decodeLoadData, documentMessage, numberField, type SectionRecord } from "./sections.ts";

interface SlackAuthor {
  slack_team_id?: string;
  slack_user_id: string;
}

const CREATED_USEC = 26;
const TOUCHED_USEC = 27;
const AUTHOR = 30;
const EDITOR = 31;
const EDITED_USEC = 32;
const EDIT_HISTORY = 124;

function text(msg: RawMessage | null, num: number): string | null {
  return msg && asString(field(msg, num));
}

// Sections name Quip users only. The edit history is what ties those ids to Slack users.
function slackAuthors(thread: RawMessage, records: SectionRecord[]): Map<string, SlackAuthor> {
  const editors = new Map(records.map((record) => [record.id, text(record.msg, EDITOR)]));
  const history = (thread.get(EDIT_HISTORY) ?? [])
    .flatMap((entry) => asMessage(entry) ?? [])
    .sort((a, b) => numberField(a, 1) - numberField(b, 1));
  const authors = new Map<string, SlackAuthor>();
  for (const entry of history) {
    const userId = text(entry, 3);
    if (!userId) continue;
    const teamId = text(entry, 4) ?? undefined;
    for (const change of entry.get(2) ?? []) {
      const quipId = editors.get(text(asMessage(change), 1));
      if (quipId) authors.set(quipId, { slack_team_id: teamId, slack_user_id: userId });
    }
  }
  return authors;
}

export function commentSnippet(bytes: Uint8Array, threadId: string, domain: string | null) {
  const document = readCanvas(bytes);
  const quote = document && annotationQuote(document.nodes, document.embeds, threadId);
  if (!quote) return null;
  const { records } = decodeLoadData(bytes);
  const section = records.find((record) => record.id === quote.sectionId);
  const message = documentMessage(bytes);
  const thread = message && asMessage(field(message, 3));
  if (!(section && thread)) return null;
  const authors = slackAuthors(thread, records);
  const author = text(section.msg, AUTHOR);
  const editor = text(section.msg, EDITOR);
  const blocks = [
    { elements: [{ elements: quote.elements, type: "rich_text_section" }], type: "rich_text" },
  ];
  return {
    control_id: threadId,
    created_usec: numberField(section.msg, CREATED_USEC),
    is_archived: false,
    last_edited_usec:
      numberField(section.msg, EDITED_USEC) || numberField(section.msg, TOUCHED_USEC),
    mrkdwn: quoteMrkdwn(quote, domain),
    rich_text: JSON.stringify({ blocks }),
    section_users: [...new Set([author, editor])].flatMap((quipId) => {
      const user = quipId && authors.get(quipId);
      if (!user) return [];
      return [
        {
          ...user,
          is_author: quipId === author,
          is_mentioned: false,
          is_most_recent_editor: quipId === editor,
          is_recent_editor: false,
          quip_user_id: quipId,
        },
      ];
    }),
  };
}
