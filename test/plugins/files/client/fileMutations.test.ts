import { beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import type { SlackFileDetail } from "@slock/types";
import { provideUi } from "@slock/ui";
import { flush } from "solid-js";
import { fileDetail } from "../../../../packages/plugins/src/files/client/api/fileDetailQuery";
import {
  fileAccess,
  fileRename,
} from "../../../../packages/plugins/src/files/client/fileMutations";
import querySetup from "../../../../packages/plugins/src/query/client/index";
import { createFakeEnv, type FakeEnv, partialService } from "../../../support/core";
import { ch, fid, uid } from "../../../support/slack";

const fileId = fid("F1");

const detail: SlackFileDetail = {
  access: {
    canManage: true,
    channels: [{ access: "read", channelId: ch("C1") }],
    hiddenChannelCount: 0,
    orgId: "T1",
    orgLevel: "none",
    users: [{ access: "read", userId: uid("U1") }],
  },
  content: null,
  contentTruncated: false,
  editable: true,
  file: { id: fileId, isImage: false, name: "plan", title: "Plan", urlPrivate: "" },
  shares: [],
  starred: false,
  viewerCount: null,
};

let env: FakeEnv;
let failures: string[];

async function settle() {
  for (let i = 0; i < 30; i++) {
    await Promise.resolve();
    flush();
  }
}

beforeEach(async () => {
  env = createFakeEnv();
  failures = [];
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    {
      id: "feedback",
      setup: (ctx) =>
        ctx.provide(
          "feedback",
          partialService<Services["feedback"]>({
            caught: (_, __, message) => {
              failures.push(message ?? "");
            },
          }),
        ),
    },
  );
  env.fetch.hold(/\/api\/files\//);
  fileDetail.set(fileId, detail);
});

const answer = (path: string, ok: boolean) => {
  const call = env.fetch.pending().find((pending) => pending.url.includes(path));
  call?.resolve(
    ok ? Response.json({ ok }) : Response.json({ error: "not_allowed", ok }, { status: 403 }),
  );
};

const access = () => fileDetail.read(fileId)?.access;
const userLevel = () => access()?.users[0]?.access;

describe("file changes", () => {
  test("a rejected access change goes back to the old level", async () => {
    void fileAccess.run({
      change: { kind: "update", level: "write", orgId: "T1", target: { userId: uid("U1") } },
      fileId,
    });
    await settle();
    expect(userLevel()).toBe("write");
    answer("/access", false);
    await settle();
    expect(userLevel()).toBe("read");
    expect(failures).toEqual(["Couldn't update access"]);
  });

  test("sharing with a new person and a channel removal show before Slack answers", async () => {
    void fileAccess.run({
      change: { kind: "add", level: "read", orgId: "T1", target: { userId: uid("U2") } },
      fileId,
    });
    await settle();
    expect(access()?.users.map((user) => user.userId)).toEqual([uid("U1"), uid("U2")]);
    answer("/access", true);
    await settle();
    fileDetail.set(fileId, detail);
    void fileAccess.run({
      change: { kind: "revoke", orgId: "T1", target: { channelId: ch("C1") } },
      fileId,
    });
    await settle();
    expect(access()?.channels).toEqual([]);
  });

  test("a rename shows at once and is undone when it fails", async () => {
    void fileRename.run({ fileId, title: "Roadmap" });
    await settle();
    expect(fileDetail.read(fileId)?.file.title).toBe("Roadmap");
    answer("/rename", false);
    await settle();
    expect(fileDetail.read(fileId)?.file.title).toBe("Plan");
    expect(failures).toEqual(["Couldn't rename the file"]);
  });
});
