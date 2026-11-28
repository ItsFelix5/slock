import { authenticate } from "./auth";
import { openDatabase } from "./db";
import { relay } from "./relay";
import { createFetch, type Handler } from "./server";
import { settings } from "./settings";
import { createSettingsStore } from "./settings/store";

const PORT = Number(Bun.env.SLOCK_CENTRAL_PORT) || 5176;
const db = openDatabase(Bun.env.SLOCK_CENTRAL_DB || "data/central.sqlite");
const features: Handler[] = [settings(createSettingsStore(db), authenticate)];

const signingSecret = Bun.env.SLACK_SIGNING_SECRET;
if (signingSecret) features.push(relay(signingSecret));
else console.warn("central: SLACK_SIGNING_SECRET is not set, relay is disabled");

Bun.serve({ fetch: createFetch(features), hostname: "0.0.0.0", port: PORT });

console.log(`central: http://localhost:${PORT}`);
