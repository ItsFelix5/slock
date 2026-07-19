import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";

function manualReload(): Plugin {
  return {
    name: 'manual-reload',
    apply: 'serve',

    configureServer(server) {
      server.ws.on('manual:reload', () => {
        server.ws.send({
          type: 'full-reload',
        })
      })
    },

    // Suppress automatic HMR updates after files are saved.
    handleHotUpdate() {
      return []
    },
  }
}

export default defineConfig(async ({ command }) => ({
  optimizeDeps: {
    exclude: ["@slock/ui", "@slock/slack-api", "@slock/blockkit"],
  },
  plugins: [
    solid(),
    manualReload(),
    // Only wired up for `vite dev` — `vite build` has no server to attach to,
    // and shouldn't need Slack credentials just to bundle static assets.
    ...(command === "serve" ? [(await import("./server/dev-plugin.ts")).slackRelayPlugin()] : []),
  ],
  resolve: {
    dedupe: ["solid-js"],
  },
}));
