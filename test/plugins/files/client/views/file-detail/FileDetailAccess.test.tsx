import { afterEach, describe, expect, test } from "bun:test";
import { createHost, type PluginDef } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { Services } from "@slock/core/types";
import type { SlackFile, SlackFileDetail, UserId } from "@slock/types";
import { provideUi } from "@slock/ui";
import { flush } from "solid-js";
import { createFakeEnv, partialService } from "../../../../../support/core";
import { mount, unmountAll } from "../../../../../support/dom";
import { ch, fid, uid } from "../../../../../support/slack";
import { sourceOf } from "../../../../composer/client/composerServices";

const ME = uid("UME");
const OWNER = uid("UOWNER");
const EDITOR = uid("UEDITOR");

function provide<K extends keyof Services>(id: K, service: Services[K]): PluginDef {
  return { id, setup: (ctx) => ctx.provide(id, service) };
}

async function render(
  access: Partial<NonNullable<SlackFileDetail["access"]>> | null,
  userId: UserId = OWNER,
) {
  const host = createHost({ env: createFakeEnv(), reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "ui", setup: provideUi },
    provide(
      "users",
      partialService<Services["users"]>({
        currentUserId: sourceOf<UserId | undefined>(ME),
        userById: () => undefined,
      }),
    ),
    provide("channels", partialService<Services["channels"]>({ channelById: () => undefined })),
  );
  const { default: FileDetailAccess } = await import(
    "../../../../../../packages/plugins/src/files/client/views/file-detail/FileDetailAccess"
  );
  const file: SlackFile = { id: fid("F1"), isImage: false, name: "a", urlPrivate: "", userId };
  const detail: SlackFileDetail = {
    access: access && {
      canManage: true,
      channels: [],
      hiddenChannelCount: 0,
      orgId: "E1",
      orgLevel: "none",
      users: [],
      ...access,
    },
    content: null,
    contentTruncated: false,
    editable: false,
    file,
    shares: [],
    starred: false,
    viewerCount: null,
  };
  const root = mount(() => <FileDetailAccess detail={detail} file={file} onNavigate={() => {}} />);
  flush();
  const rows = () =>
    [...root.querySelectorAll(".file-detail-access-row")].map((row) => ({
      locked: [...row.querySelectorAll("optgroup option")].map((option) => option.textContent),
      reason: row.querySelector("optgroup")?.label,
      removable: !!row.querySelector("button[aria-label='Remove']"),
      editable: !!row.querySelector("select"),
      subject: row.querySelector(".file-detail-access-subject")?.textContent,
    }));
  return { root, rows };
}

afterEach(unmountAll);

describe("FileDetailAccess", () => {
  test("says when access could not be loaded", async () => {
    const { root } = await render(null);
    expect(root.textContent).toContain("Couldn't load access.");
  });

  test("lists the owner first and never lets owner, self or creator be changed", async () => {
    const { rows } = await render(
      {
        users: [
          { access: "write", userId: ME },
          { access: "write", userId: EDITOR },
          { access: "write", userId: uid("UCREATOR") },
          { access: "owner", userId: OWNER },
        ],
      },
      uid("UCREATOR"),
    );
    const people = rows().slice(0, 4);
    expect(people.map((row) => [row.subject, row.editable, row.removable])).toEqual([
      ["UOWNER", false, false],
      ["UME", false, false],
      ["UEDITOR", true, true],
      ["UCREATOR", false, false],
    ]);
  });

  test("locks downgrades for edit access held elsewhere", async () => {
    const { rows } = await render({
      channels: [{ access: "write", channelId: ch("C1"), name: "general" }],
      orgLevel: "write",
      users: [{ access: "write", editHeldBy: "channel", userId: EDITOR }],
    });
    const [person, channel] = rows();
    expect(person?.reason).toBe("This person has edit access through a certain channel.");
    expect(person?.locked).toEqual(["Can comment", "Can view"]);
    expect(channel?.reason).toBe("Everyone in your organization has the ability to edit.");
    expect(person?.removable && channel?.removable).toBe(true);
  });

  test("is read only without manage rights", async () => {
    const { root } = await render({
      canManage: false,
      channels: [{ access: "read", channelId: ch("C1"), name: "general" }],
      hiddenChannelCount: 2,
      orgLevel: "comment",
      orgName: "Acme",
      users: [{ access: "write", userId: EDITOR }],
    });
    expect(root.querySelector("select")).toBeNull();
    expect(root.querySelector("button[aria-label='Remove']")).toBeNull();
    expect(root.textContent).toContain("2 other channels");
    expect(root.textContent).toContain("Anyone in Acme can comment");
    expect(root.textContent).not.toContain("Add people");
  });
});
