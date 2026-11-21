import { expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv, partialService } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import { parseUserId } from "@slock/slack";
import type { ProfileFieldDef, User } from "@slock/types";
import { createRoot, createSignal, flush } from "solid-js";

const ME = parseUserId("UME");
const OTHER = parseUserId("UOTHER");
const user = (patch: Partial<User> = {}): User => ({
  avatarColor: "#000",
  id: ME,
  name: "Me",
  title: "Dev",
  ...patch,
});

async function start() {
  const [currentUser, setCurrentUser] = createSignal<User | undefined>(user());
  const [nicknames, setNicknames] = createSignal<Record<string, string>>({});
  const [fieldDefs, setFieldDefs] = createSignal<ProfileFieldDef[]>();
  const host = createHost({ env: createFakeEnv(1, 1_000_000), reactive: solidReactive });
  setHost(host);
  await host.register({
    id: "users",
    setup: (ctx) =>
      ctx.provide(
        "users",
        partialService<Services["users"]>({
          currentUser,
          customFieldsFor: () => [{ id: "Xf1", value: "blue" }],
          nicknameFor: (id) => nicknames()[id],
        }),
      ),
  });
  const { createProfileForm } = await import("../../../../src/profile/client/views/profileForm");
  const [userId, setUserId] = createSignal(ME);
  const form = createRoot(() => createProfileForm({ fieldDefs, user: currentUser, userId }));
  flush();
  return { form, setCurrentUser, setFieldDefs, setNicknames, setUserId };
}

test("seeds the self inputs from the current user", async () => {
  const { form } = await start();
  expect(form.inputs.title).toBe("Dev");
  expect(form.inputs.name).toBe("Me");
});

test("a change to the current user keeps what is being typed", async () => {
  const { form, setCurrentUser } = await start();
  form.setInput("title", "Typing");
  setCurrentUser(user({ presence: "away" }));
  flush();
  expect(form.inputs.title).toBe("Typing");
});

test("viewing another user leaves the self inputs untouched and a late nickname is seeded", async () => {
  const { form, setNicknames, setUserId } = await start();
  setUserId(OTHER);
  flush();
  expect(form.inputs.title).toBe("Dev");
  setNicknames({ [OTHER]: "Otto" });
  flush();
  expect(form.inputs.nickname).toBe("Otto");
});

test("loaded custom fields fill only the values that are still missing", async () => {
  const { form, setFieldDefs } = await start();
  form.setCustomValue("Xf2", "typed");
  setFieldDefs([
    { id: "Xf1", label: "Color" },
    { id: "Xf2", label: "Pet" },
  ]);
  flush();
  expect({ ...form.customValues }).toEqual({ Xf1: "blue", Xf2: "typed" });
});
