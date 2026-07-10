import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig(async ({ command }) => ({
  plugins: [
    solid(),
    // Only wired up for `vite dev` — `vite build` has no server to attach to,
    // and shouldn't need Slack credentials just to bundle static assets.
    ...(command === "serve" ? [(await import("./server/dev-plugin")).slackRelayPlugin()] : []),
  ],
  resolve: {
    dedupe: ["solid-js"],
  },
  optimizeDeps: {
    exclude: ["@slock/ui", "@slock/slack-api", "@slock/blockkit"],
  },
}));
