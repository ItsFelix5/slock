import type { ButtonElement } from '../types';
import BkText from '../BkText';
import { showToast } from '../../toast';

export default function Button(props: { el: ButtonElement }) {
  const onClick = () => {
    if (props.el.url) return;
    showToast('This button needs its app to respond — not supported in this client.');
  };

  return props.el.url ? (
    <a
      class={`bk-button bk-button--${props.el.style ?? 'default'}`}
      href={props.el.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <BkText text={props.el.text} />
    </a>
  ) : (
    <button type="button" class={`bk-button bk-button--${props.el.style ?? 'default'}`} onClick={onClick}>
      <BkText text={props.el.text} />
    </button>
  );
}
