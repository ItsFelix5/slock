import { For, Show, createSignal } from 'solid-js';
import type { OverflowElement } from '../types';
import BkText from '../BkText';
import Icon from '../../icons';
import { showToast } from '../../lib/toast';

export default function Overflow(props: { el: OverflowElement }) {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="bk-overflow-wrap">
      <button type="button" class="bk-overflow-btn" onClick={() => setOpen(!open())} title="More options">
        <Icon name="moreVertical" size={16} />
      </button>
      <Show when={open()}>
        <div class="bk-overflow-menu">
          <For each={props.el.options}>
            {(opt) => (
              <button
                type="button"
                class="bk-overflow-item"
                onClick={() => {
                  setOpen(false);
                  if (opt.url) window.open(opt.url, '_blank', 'noopener,noreferrer');
                  else showToast('This option needs its app to respond — not supported in this client.');
                }}
              >
                <BkText text={opt.text} />
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
