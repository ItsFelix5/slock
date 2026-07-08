import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  resolve: {
    dedupe: ["solid-js"],
  },
  optimizeDeps: {
    exclude: ["@slock/ui", "@slock/slack-api", "@slock/blockkit"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:5174",
      "/ws": { target: "ws://localhost:5174", ws: true },
    },
  },
});
