import { createSignal } from 'solid-js';
import { activeView, channelById, dmById, userById, sendMessage } from '../store';
import Icon, { type IconName } from '../icons';
import './Composer.css';

const TOOLBAR: { icon: IconName; title: string }[] = [
  { icon: 'bold', title: 'Bold' },
  { icon: 'italic', title: 'Italic' },
  { icon: 'underline', title: 'Underline' },
  { icon: 'strikethrough', title: 'Strikethrough' },
  { icon: 'link', title: 'Link' },
  { icon: 'numberedList', title: 'Ordered list' },
  { icon: 'bulletedList', title: 'Bulleted list' },
  { icon: 'quote', title: 'Blockquote' },
  { icon: 'code', title: 'Code' },
  { icon: 'codeBlock', title: 'Code block' },
];

export default function Composer(props: { channelId?: string; threadTs?: string; placeholder?: string }) {
  const [text, setText] = createSignal('');

  const targetChannelId = () => props.channelId ?? activeView()?.id;

  const placeholder = () => {
    if (props.placeholder) return props.placeholder;
    const v = activeView();
    if (!v) return 'Message';
    if (v.kind === 'channel') return `Message #${channelById(v.id)?.name ?? ''}`;
    const dm = dmById(v.id);
    return `Message ${dm ? userById(dm.userId)?.name ?? '' : ''}`;
  };

  const submit = (e: Event) => {
    e.preventDefault();
    const id = targetChannelId();
    if (!id) return;
    sendMessage(id, text(), props.threadTs);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      submit(e);
    }
  };

  return (
    <form class="composer" onSubmit={submit}>
      <div class="composer-toolbar">
        {TOOLBAR.map((tool) => (
          <button type="button" class="composer-tool" title={tool.title}>
            <Icon name={tool.icon} size={15} />
          </button>
        ))}
      </div>
      <textarea
        class="composer-input"
        placeholder={placeholder()}
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={!targetChannelId()}
      />
      <div class="composer-footer">
        <button type="button" class="composer-tool" title="Attach">
          <Icon name="plus" size={16} />
        </button>
        <button type="button" class="composer-tool composer-tool-text" title="Formatting">
          Aa
        </button>
        <button type="button" class="composer-tool" title="Emoji">
          <Icon name="emoji" size={16} />
        </button>
        <button type="button" class="composer-tool" title="Mention someone">
          <Icon name="mentions" size={16} />
        </button>
        <button type="button" class="composer-tool" title="More options">
          <Icon name="more" size={16} />
        </button>
        <button type="submit" class="composer-send" disabled={!text().trim()} title="Send">
          <Icon name="send" size={15} />
        </button>
      </div>
    </form>
  );
}
