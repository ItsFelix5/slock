import { assets, upload } from "./assets";
import { type Kind, type Message, messageOf } from "./blocks";
import { persona } from "./persona";
import { CHANNELS, type ChannelSpec } from "./plan";
import { chance, int, pick, weighted } from "./random";
import { type Obj, openBot, openSession, type Reply, record, type Session, text } from "./slack";
import { EMOJI, words } from "./text";
import { loadWorld, type World } from "./world";

const [credsPath, botPath] = process.argv.slice(2);
if (!(credsPath && botPath))
  throw new Error("usage: bun test/chaos/seed.ts <creds.json> <bot-token.txt>");
const SCALE = Number(process.env.CHAOS_SCALE ?? 1);
const ONLY = process.env.CHAOS_ONLY?.split(",");

type Author = { session: Session; persona: boolean };
type Posted = { ts: string; author: Author };
type Ctx = { user: Author; bot: Author; world: World; channel: string; spec: ChannelSpec };

const stats = { ok: 0, failed: 0, errors: new Map<string, number>() };

function tally(scope: string, reply: Reply): void {
  if (reply.ok) {
    stats.ok++;
    if (stats.ok % 500 === 0) console.log(`posted ${stats.ok} (failed ${stats.failed})`);
    return;
  }
  stats.failed++;
  const key = `${scope}: ${reply.error ?? "unknown"}`;
  const seen = stats.errors.get(key) ?? 0;
  stats.errors.set(key, seen + 1);
  if (seen < 2) console.log("error", key, JSON.stringify(reply).slice(0, 500));
}

async function post(
  author: Author,
  channel: string,
  msg: Message,
  extra: Obj = {},
): Promise<Reply> {
  const reply = await author.session.call("chat.postMessage", {
    channel,
    text: msg.text,
    ...(msg.blocks ? { blocks: msg.blocks } : {}),
    ...(msg.attachments ? { attachments: msg.attachments } : {}),
    ...(author.persona ? persona() : {}),
    ...extra,
  });
  tally("post", reply);
  return reply;
}

function choose({ spec, user, bot }: Ctx): Author {
  if (spec.voice === "persona") return bot;
  if (spec.voice === "mixed" && chance(0.8)) return bot;
  return user;
}

async function sideEffects(ctx: Ctx, posted: Posted[]): Promise<void> {
  if (posted.length === 0) return;
  const { user, world, channel } = ctx;
  const target = (): Posted => pick(posted);
  if (chance(0.12)) {
    const timestamp = target().ts;
    for (let i = int(1, 5); i > 0; i--) {
      tally(
        "react",
        await user.session.call("reactions.add", {
          channel,
          timestamp,
          name: pick([...EMOJI, ...world.emoji]),
        }),
      );
    }
  }
  if (chance(0.03)) {
    const author = choose(ctx);
    const reply = await post(author, channel, messageOf("chat", world), {
      thread_ts: target().ts,
      reply_broadcast: chance(0.3),
    });
    if (reply.ok) posted.push({ ts: text(reply, "ts"), author });
  }
  if (chance(0.02)) {
    const mine = target();
    tally(
      "edit",
      await mine.author.session.call("chat.update", {
        channel,
        ts: mine.ts,
        text: `edited ${words(4)}`,
      }),
    );
  }
  if (chance(0.01)) {
    const mine = target();
    const reply = await mine.author.session.call("chat.delete", { channel, ts: mine.ts });
    tally("delete", reply);
    if (reply.ok) posted.splice(posted.indexOf(mine), 1);
  }
  if (chance(0.005))
    tally("pin", await user.session.call("pins.add", { channel, timestamp: target().ts }));
  if (chance(0.003))
    tally("star", await user.session.call("stars.add", { channel, timestamp: target().ts }));
}

async function runChannel(ctx: Ctx): Promise<void> {
  const { spec, world, channel, user } = ctx;
  const posted: Posted[] = [];
  if (spec.threadReplies) {
    const parent = await post(user, channel, messageOf("chat", world));
    if (parent.ok) {
      const parentTs = text(parent, "ts");
      posted.push({ ts: parentTs, author: user });
      for (let i = 0; i < Math.round(spec.threadReplies * SCALE); i++) {
        await post(choose(ctx), channel, messageOf("chat", world), { thread_ts: parentTs });
      }
    }
  }
  const total = Math.round(spec.messages * SCALE);
  for (let i = 0; i < total; i++) {
    const author = choose(ctx);
    const reply = await post(author, channel, messageOf(weighted(spec.mix), world));
    if (reply.ok) posted.push({ ts: text(reply, "ts"), author });
    await sideEffects(ctx, posted);
  }
}

async function ensureChannel(session: Session, world: World, spec: ChannelSpec): Promise<string> {
  const created = await session.call("conversations.create", {
    name: spec.name,
    is_private: spec.private === true,
  });
  if (created.ok) return text(record(created, "channel"), "id");
  const existing = world.channelIds.get(spec.name);
  if (created.error === "name_taken" && existing) return existing;
  throw new Error(`${spec.name}: ${created.error}`);
}

async function inviteEveryone(
  session: Session,
  world: World,
  channel: string,
  botId: string,
): Promise<void> {
  await session.call("conversations.invite", { channel, users: botId });
  const users = world.users.filter((u) => u !== world.self);
  await session.call("conversations.invite", { channel, users: users.join(",") });
}

async function selfDm(user: Author, world: World): Promise<void> {
  const opened = await user.session.call("conversations.open", { users: world.self });
  if (!opened.ok) {
    console.log("self dm failed", opened.error);
    return;
  }
  const channel = text(record(opened, "channel"), "id");
  const kinds: Kind[] = ["chat", "sections", "interactive", "richText"];
  for (let i = 0; i < Math.round(200 * SCALE); i++) {
    tally("dm", await post(user, channel, messageOf(pick(kinds), world)));
  }
}

async function smoke(user: Author, world: World): Promise<void> {
  const channel = await ensureChannel(user.session, world, {
    name: "chaos-smoke",
    messages: 0,
    mix: [],
  });
  const kinds: Kind[] = [
    "chat",
    "long",
    "sections",
    "interactive",
    "richText",
    "tables",
    "markdown",
    "cards",
    "fiftyBlocks",
    "legacy",
    "video",
  ];
  for (const kind of kinds) {
    for (let i = 0; i < 3; i++) {
      const reply = await post(user, channel, messageOf(kind, world));
      console.log(kind, reply.ok ? "ok" : `FAILED ${reply.error}`);
    }
  }
  for (const asset of assets().slice(0, 3)) await upload(user.session, world, channel, asset);
  console.log("stats", stats.ok, stats.failed, [...stats.errors.entries()]);
}

const session = await openSession(credsPath);
const bot = await openBot(botPath);
const world = await loadWorld(session);
const user: Author = { session, persona: false };
const botAuthor: Author = { session: bot, persona: true };

if (process.env.CHAOS_SMOKE) {
  await smoke(user, world);
} else {
  const jobs: { spec: ChannelSpec; id: string }[] = [];
  for (const spec of CHANNELS.filter((c) => !ONLY || ONLY.includes(c.name))) {
    const id = await ensureChannel(session, world, spec);
    await inviteEveryone(session, world, id, bot.userId);
    jobs.push({ spec, id });
  }
  const filesJob = jobs.find(({ spec }) => spec.name === "chaos-files");
  if (filesJob) for (const asset of assets()) await upload(session, world, filesJob.id, asset);
  await Promise.all([
    ...jobs.map(({ spec, id }) => runChannel({ user, bot: botAuthor, world, channel: id, spec })),
    ...(ONLY ? [] : [selfDm(user, world)]),
  ]);
  for (const { spec, id } of jobs) {
    if (spec.finish === "archive") await session.call("conversations.archive", { channel: id });
    if (spec.finish === "rename")
      await session.call("conversations.rename", { channel: id, name: `${spec.name}-after` });
  }
  console.log("done", stats.ok, stats.failed, [...stats.errors.entries()]);
}
