import type { Component } from "solid-js";
import type { createBootstrapStore } from "./store";

declare module "@slock/core/types" {
  interface Points {
    "bootstrap.error.action": Component;
    "bootstrap.retry": () => void;
  }
  interface Services {
    bootstrap: ReturnType<typeof createBootstrapStore>;
  }
}
