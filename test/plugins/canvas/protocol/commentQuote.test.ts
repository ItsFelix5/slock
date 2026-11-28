import { expect, test } from "bun:test";
import {
  annotationQuote,
  quoteMrkdwn,
} from "../../../../packages/plugins/src/canvas/protocol/annotationQuote.ts";
import { commentSnippet } from "../../../../packages/plugins/src/canvas/protocol/commentSnippet.ts";
import { readCanvas } from "../../../../packages/plugins/src/canvas/protocol/document.ts";
import {
  messageField,
  stringField,
  varintField,
} from "../../../../packages/plugins/src/canvas/protocol/protobufWrite.ts";
import { uid } from "../../../support/slack";
import { editOf, Server, sectionId } from "./canvasSimulator";

const thread = sectionId(90);
const mention = sectionId(91);

function commented() {
  const server = new Server();
  const line = (n: number, after: string | null, html: string) => ({
    after,
    node: {
      checked: false,
      frames: [],
      html,
      id: sectionId(n),
      indent: 0,
      kind: "paragraph" as const,
      level: 0,
    },
  });
  server.apply(
    editOf({
      controls: [
        { id: thread, kind: "annotation" },
        { id: mention, kind: "user", userId: uid("U2") },
      ],
      title: "Notes",
      upserts: [
        line(
          1,
          null,
          `Before <annotation id="${thread}"><b>a &lt; b</b> <control id="${mention}"></control></annotation> after`,
        ),
        line(2, sectionId(1), `<annotation id="${thread}">next</annotation>`),
      ],
    }),
  );
  return server;
}

test("a quote keeps mentions and spans every annotated line", () => {
  const document = readCanvas(commented().loadData());
  const quote = document && annotationQuote(document.nodes, document.embeds, thread);

  expect(quote?.sectionId).toBe(sectionId(1));
  expect(quote && quoteMrkdwn(quote, null)).toBe("a &lt; b <@U2>\nnext");
});

test("an annotation the canvas does not have has no quote", () => {
  expect(commentSnippet(commented().loadData(), sectionId(7), null)).toBeNull();
});

test("the creation snippet names the section's authors by their Slack ids", () => {
  const server = commented();
  const section = server.sections.get(sectionId(1));
  const quip = (value: string) => [{ bytes: new TextEncoder().encode(value) }];
  section?.set(26, [{ varint: 10n }]);
  section?.set(30, quip("quipA"));
  section?.set(31, quip("quipB"));
  section?.set(32, [{ varint: 20n }]);
  const edit = (at: number, userId: string) =>
    messageField(124, [
      ...varintField(1, at),
      ...messageField(2, stringField(1, sectionId(1))),
      ...stringField(3, userId),
      ...stringField(4, "T1"),
    ]);

  const snippet = commentSnippet(
    server.loadData([...edit(2, "U3"), ...edit(1, "U2")]),
    thread,
    null,
  );

  expect(snippet).toMatchObject({
    control_id: thread,
    created_usec: 10,
    last_edited_usec: 20,
    mrkdwn: "a &lt; b <@U2>\nnext",
    section_users: [{ is_most_recent_editor: true, quip_user_id: "quipB", slack_user_id: "U3" }],
  });
});
