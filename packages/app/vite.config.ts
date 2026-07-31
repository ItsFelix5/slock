import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";

function manualReload(): Plugin {
  return {
    name: "manual-reload",
    apply: "serve",

    handleHotUpdate() {
      return [];
    },
  };
}

export default defineConfig(async ({ command }) => ({
  optimizeDeps: {
    exclude: ["@slock/ui", "@slock/slack-api", "@slock/blockkit"],
  },
  plugins: [
    solid(),
    manualReload(),
    ...(command === "serve" ? [(await import("./server/dev-plugin.ts")).slackRelayPlugin()] : []),
  ],
  resolve: {
    dedupe: ["solid-js"],
  },
}));
