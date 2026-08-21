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
    exclude: ["@slock/ui", "@slock/types", "@slock/blockkit"],
  },
  plugins: [
    solid(),
    manualReload(),
    ...(command === "serve" ? [(await import("@slock/server/dev-plugin")).appServerPlugin()] : []),
  ],
  resolve: {
    dedupe: ["solid-js"],
  },
}));
