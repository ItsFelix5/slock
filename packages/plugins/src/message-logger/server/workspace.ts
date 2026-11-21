import { type Credentials, teamIdFromRoute } from "@slock/plugins/slack/server/api/auth";

export const workspaceOf = (creds: Credentials) => teamIdFromRoute(creds.route);

export const ownerOf = (creds: Credentials) =>
  new Bun.CryptoHasher("sha256").update(creds.token).digest("hex");
