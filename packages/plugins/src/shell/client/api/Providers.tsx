import { usePoint } from "@slock/core/solid";
import type { JSX } from "@solidjs/web";

export function Providers(props: { children: JSX.Element }) {
  const providers = usePoint("shell.provider");
  const wrap = (index: number): JSX.Element => {
    const Provider = providers()[index];
    return Provider ? <Provider>{wrap(index + 1)}</Provider> : props.children;
  };
  return <>{wrap(0)}</>;
}
