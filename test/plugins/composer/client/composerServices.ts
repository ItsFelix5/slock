import { createEmojiSource } from "@slock/blockkit";
import type { PluginDef } from "@slock/core";
import type { Services } from "@slock/core/types";
import { parseChannelId, parseUserId } from "@slock/slack";
import type { Channel, User, UserId } from "@slock/types";
import { provideUi } from "@slock/ui";
import { createMemo, createRoot } from "solid-js";
import { createPendingFilesStore } from "../../../../packages/plugins/src/composer/client/lib/pendingFiles";
import { createDraftStore } from "../../../../packages/plugins/src/drafts/client/draftStore";
import { createDraftsService } from "../../../../packages/plugins/src/drafts/client/draftsService";
import { emojiAutoconvert } from "../../../../packages/plugins/src/emoji/client/api/emojiAutoconvert";
import { createEmojiIndex } from "../../../../packages/plugins/src/emoji/client/api/emojiSearch";
import querySetup from "../../../../packages/plugins/src/query/client/index";
import { createFakeEnv, partialService } from "../../../support/core";

const ME: User = { avatarColor: "#000", id: parseUserId("U0"), name: "me" };
const USERS: User[] = [
  ME,
  { avatarColor: "#000", id: parseUserId("U1"), name: "ann" },
  { avatarColor: "#000", id: parseUserId("U2"), name: "bob" },
];
const CHANNELS: Channel[] = [
  {
    archived: false,
    id: parseChannelId("C1"),
    name: "general",
    private: false,
    topic: "",
    unread: false,
  },
  {
    archived: false,
    id: parseChannelId("C2"),
    name: "dev",
    private: false,
    topic: "",
    unread: false,
  },
];
const USER_IDS = new Set<UserId>(USERS.map((user) => user.id));

export function sourceOf<T>(value: T) {
  return createRoot(() => createMemo(() => value));
}
const emojiSource = createEmojiSource(async () => ({ aliases: new Map(), urls: new Map() }));
const USERGROUPS = [{ id: "S1", name: "@devs" }];

export interface SentMessage {
  blocks: unknown;
  channelId: string;
  text: string;
  threadTs: string | undefined;
}

export interface Outbox {
  failNext: boolean;
  sent: SentMessage[];
}

function provide<K extends keyof Services>(id: K, service: Services[K]): PluginDef {
  return { id, setup: (ctx) => ctx.provide(id, service) };
}

export function composerServices(outbox: Outbox): PluginDef[] {
  const titleOf = (id: string) => CHANNELS.find((channel) => channel.id === id)?.name ?? id;
  return [
    provide(
      "messages",
      partialService<Services["messages"]>({
        sendFiles: () => Promise.resolve(),
        sendMessage: (channelId, text, _unfurl, threadTs, blocks) => {
          if (outbox.failNext) {
            outbox.failNext = false;
            return Promise.reject(new Error("offline"));
          }
          outbox.sent.push({ blocks, channelId, text, threadTs });
          return Promise.resolve();
        },
      }),
    ),
    provide(
      "feedback",
      partialService<Services["feedback"]>({ flash: () => {}, get: () => undefined }),
    ),
    provide(
      "slash-commands",
      partialService<Services["slash-commands"]>({
        available: () => [],
        handleSlashCommand: () => Promise.resolve({ handled: false, succeeded: false }),
        load: () => Promise.resolve([]),
      }),
    ),
    provide(
      "users",
      partialService<Services["users"]>({
        currentUser: sourceOf<User | undefined>(ME),
        currentUserId: sourceOf(ME.id),
        knownUsers: sourceOf(USERS),
        searchUsers: () => Promise.resolve([]),
        userById: (id) => USERS.find((user) => user.id === id),
      }),
    ),
    provide(
      "channels",
      partialService<Services["channels"]>({
        channelById: (id) => CHANNELS.find((channel) => channel.id === id),
        channelManagerIds: () => new Set<UserId>(),
        channelRosterIds: () => USER_IDS,
        channels: sourceOf(CHANNELS),
        ensureChannelManagers: () => Promise.resolve(new Set<UserId>()),
        ensureChannelRoster: () => Promise.resolve(USER_IDS),
        isChannelMember: () => true,
      }),
    ),
    { id: "ui", setup: provideUi },
    { id: "query", setup: querySetup },
    provide("titles", partialService<Services["titles"]>({ label: titleOf, title: titleOf })),
    provide(
      "usergroups",
      partialService<Services["usergroups"]>({
        isSelfMember: () => false,
        mentionableUsergroups: () => USERGROUPS,
        usergroupById: (id) => USERGROUPS.find((group) => group.id === id),
      }),
    ),
    provide(
      "prefs",
      partialService<Services["prefs"]>({
        emojiUseScore: () => 0,
        frecencyScore: () => 0,
        usedEmojiNames: () => [],
      }),
    ),
    {
      id: "drafts",
      setup: (ctx) =>
        ctx.provide("drafts", createDraftsService(createDraftStore(), createFakeEnv())),
    },
    provide("templates", partialService<Services["templates"]>({ templates: sourceOf([]) })),
    provide("composer", {
      pendingFiles: createPendingFilesStore(),
      uploadOnAttach: () => false,
    }),
    { id: "emoji", setup: (ctx) => ctx.provide("emoji", createEmojiIndex(emojiSource)) },
    { id: "emoji-autoconvert", setup: (ctx) => ctx.add("composer.editor", emojiAutoconvert) },
  ];
}
