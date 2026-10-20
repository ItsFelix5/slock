import { type Credentials, teamIdFromRoute } from "../../slack/server/api/auth";

export const workspaceOf = (creds: Credentials) => teamIdFromRoute(creds.route) ?? creds.route;

export const ownerOf = (creds: Credentials) =>
  new Bun.CryptoHasher("sha256").update(creds.token).digest("hex");
