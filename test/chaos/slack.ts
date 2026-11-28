import { readFile } from "node:fs/promises";

export type Obj = Record<string, unknown>;
export type Reply = Obj & { ok: boolean; error?: string };
export type Session = {
  call: (method: string, body?: Obj) => Promise<Reply>;
  callForm: (method: string, params: Record<string, string>) => Promise<Reply>;
  userId: string;
};

const TEAM_ID = "T0C52HURKUK";
const TEAM_NAME = "testing chamber";
const TRAILING_SLASH = /\/$/;

export function text(obj: Obj, key: string): string {
  const value = obj[key];
  if (typeof value !== "string")
    throw new Error(`${key} missing in ${JSON.stringify(obj).slice(0, 300)}`);
  return value;
}

export function list(obj: Obj, key: string): Obj[] {
  const value = obj[key];
  return Array.isArray(value) ? value : [];
}

const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null;

export function record(obj: Obj, key: string): Obj {
  const value = obj[key];
  return isObj(value) ? value : {};
}

async function connect(base: string, auth: Record<string, string>): Promise<Session> {
  const send = async (method: string, body: BodyInit, contentType: string): Promise<Reply> => {
    for (;;) {
      const res = await fetch(`${base}${method}`, {
        method: "POST",
        headers: { ...auth, "content-type": contentType },
        body,
      });
      const json: unknown = await res.json();
      if (!isObj(json)) return { ok: false, error: `non_object_reply_${res.status}` };
      const reply: Reply = {
        ...json,
        ok: json.ok === true,
        error: typeof json.error === "string" ? json.error : undefined,
      };
      if (res.status === 429 || reply.error === "ratelimited") {
        await Bun.sleep(Number(res.headers.get("retry-after") ?? 1) * 1000);
        continue;
      }
      return reply;
    }
  };

  const call = (method: string, body: Obj = {}): Promise<Reply> =>
    send(method, JSON.stringify(body), "application/json; charset=utf-8");
  const callForm = (method: string, params: Record<string, string>): Promise<Reply> =>
    send(method, new URLSearchParams(params), "application/x-www-form-urlencoded");

  const who = await call("auth.test");
  if (!who.ok || who.team_id !== TEAM_ID || who.team !== TEAM_NAME) {
    throw new Error(
      `refusing to run: token resolves to ${String(who.team)} (${String(who.team_id)})`,
    );
  }
  return { call, callForm, userId: text(who, "user_id") };
}

export async function openSession(credsPath: string): Promise<Session> {
  const creds = JSON.parse(await readFile(credsPath, "utf8"));
  const team = creds.teams[TEAM_ID];
  return connect(`${String(team.url).replace(TRAILING_SLASH, "")}/api/`, {
    authorization: `Bearer ${team.token}`,
    cookie: `d=${creds.d}`,
  });
}

export async function openBot(tokenPath: string): Promise<Session> {
  const token = (await readFile(tokenPath, "utf8")).trim();
  return connect("https://slack.com/api/", { authorization: `Bearer ${token}` });
}
