import type { Accessor, Component } from "solid-js";

export type HomeSectionProps = { unreadsOnly: Accessor<boolean> };

declare module "@slock/core/types" {
  interface Points {
    "home.section": Component<HomeSectionProps>;
  }
}
