import { pathKey } from "../selection";

export default function DividerBlockView(props: { blockPath: number[] }) {
  return (
    <hr
      class="rt-block bk-divider"
      contentEditable={false}
      data-rt-path={pathKey(props.blockPath)}
    />
  );
}
