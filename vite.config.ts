import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  server: {
    proxy: {
      "/api": "http://localhost:5174",
      "/ws": { target: "ws://localhost:5174", ws: true },
    },
  },
});
