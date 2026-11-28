import { logUnknown } from "@slock/core";
import { untrack } from "solid-js";

export default function Unsupported(props: { kind: "block" | "chart" | "element"; type: string }) {
  untrack(() => logUnknown(props.kind, props.type));
  return (
    <div class="bk-unsupported">
      [unsupported {props.kind}: {props.type}]
    </div>
  );
}
