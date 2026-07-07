import { For, Show, createEffect, createSignal } from 'solid-js';
import { activeView, channelById, dmById, userById, sendMessage, handleSlashCommand, recordEmojiUse } from '../store';
import { uploadFile } from '../slackApi';
import { showToast } from '../toast';
import Icon, { type IconName } from '../icons';
import EmojiPicker from './EmojiPicker';
import ComposeUserPicker from './ComposeUserPicker';
import './Composer.css';

type WrapTool = { icon: IconName; title: string; before: string; after?: string };
type LineTool = { icon: IconName; title: string; linePrefix: string };

const WRAP_TOOLS: WrapTool[] = [
  { icon: 'bold', title: 'Bold', before: '*' },
  { icon: 'italic', title: 'Italic', before: '_' },
  { icon: 'strikethrough', title: 'Strikethrough', before: '~' },
  { icon: 'code', title: 'Inline code', before: '`' },
];

const LINE_TOOLS: LineTool[] = [
  { icon: 'bulletedList', title: 'Bulleted list', linePrefix: '• ' },
  { icon: 'numberedList', title: 'Ordered list', linePrefix: '1. ' },
  { icon: 'quote', title: 'Blockquote', linePrefix: '&gt; ' },
];

const DRAFTS_KEY = 'slock-drafts';

function loadDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

const drafts = loadDrafts();

function persistDrafts() {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export default function Composer(props: { channelId?: string; threadTs?: string; placeholder?: string }) {
  const [text, setText] = createSignal('');
  const [toolbarOpen, setToolbarOpen] = createSignal(true);
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [pendingFiles, setPendingFiles] = createSignal<File[]>([]);
  const [dragOver, setDragOver] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

  const targetChannelId = () => props.channelId ?? activeView()?.id;
  const draftKey = () => (props.threadTs ? `thread:${props.threadTs}` : targetChannelId());

  // The composer is a single long-lived component reused across every channel/DM
  // (and once per open thread) rather than remounted on switch, so without this
  // the exact same in-progress text would carry over when you change channels.
  createEffect((prevKey: string | undefined) => {
    const key = draftKey();
    if (key !== prevKey) setText((key && drafts[key]) || '');
    return key;
  }, undefined);

  createEffect(() => {
    const key = draftKey();
    if (!key) return;
    const value = text();
    if (value.trim()) drafts[key] = value;
    else delete drafts[key];
    persistDrafts();
  });

  const placeholder = () => {
    if (props.placeholder) return props.placeholder;
    const v = activeView();
    if (!v) return 'Message';
    if (v.kind === 'channel') return `Message #${channelById(v.id)?.name ?? ''}`;
    const dm = dmById(v.id);
    return `Message ${dm ? userById(dm.userId)?.name ?? '' : ''}`;
  };

  function applyAtCursor(mutate: (value: string, start: number, end: number) => { next: string; cursor: number }) {
    const el = textareaRef;
    if (!el) return;
    const { next, cursor } = mutate(el.value, el.selectionStart, el.selectionEnd);
    el.value = next;
    setText(next);
    el.focus();
    el.setSelectionRange(cursor, cursor);
  }

  const wrapSelection = (before: string, after: string = before) => {
    applyAtCursor((value, start, end) => {
      const selected = value.slice(start, end);
      const next = value.slice(0, start) + before + selected + after + value.slice(end);
      return { next, cursor: start + before.length + selected.length + after.length };
    });
  };

  const prefixLines = (prefix: string) => {
    applyAtCursor((value, start, end) => {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const before = value.slice(0, lineStart);
      const affected = value.slice(lineStart, end);
      const prefixed = affected
        .split('\n')
        .map((line) => prefix + line)
        .join('\n');
      const next = before + prefixed + value.slice(end);
      return { next, cursor: next.length - (value.length - end) };
    });
  };

  const insertLink = () => {
    applyAtCursor((value, start, end) => {
      const selected = value.slice(start, end);
      const isUrl = /^https?:\/\//.test(selected);
      const inserted = isUrl ? `<${selected}>` : `<https://|${selected || 'link text'}>`;
      const next = value.slice(0, start) + inserted + value.slice(end);
      return { next, cursor: start + inserted.length };
    });
  };

  const insertText = (fragment: string) => {
    applyAtCursor((value, start, end) => {
      const next = value.slice(0, start) + fragment + value.slice(end);
      return { next, cursor: start + fragment.length };
    });
  };

  const addFiles = (fileList: FileList | File[]) => {
    setPendingFiles([...pendingFiles(), ...Array.from(fileList)]);
  };

  const removeFile = (index: number) => {
    setPendingFiles(pendingFiles().filter((_, i) => i !== index));
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const id = targetChannelId();
    if (!id) return;
    const files = pendingFiles();
    const trimmed = text().trim();
    if (!trimmed && files.length === 0) return;

    if (files.length === 0) {
      if (trimmed.startsWith('/')) {
        setText('');
        const handled = await handleSlashCommand(id, props.threadTs, trimmed);
        if (handled) return;
      }
      sendMessage(id, trimmed, props.threadTs);
      setText('');
      return;
    }

    setSending(true);
    setPendingFiles([]);
    setText('');
    try {
      await uploadFile(id, files[0], props.threadTs, trimmed || undefined);
      for (const file of files.slice(1)) {
        await uploadFile(id, file, props.threadTs);
      }
    } catch (err) {
      console.error('Failed to upload file', err);
      showToast('Failed to upload file.');
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      submit(e);
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  return (
    <form
      class="composer"
      classList={{ 'drag-over': dragOver() }}
      onSubmit={submit}
      onDragOver={(e) => {
        e.preventDefault();
        if (targetChannelId()) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <div class="composer-toolbar" classList={{ hidden: !toolbarOpen() }}>
        {WRAP_TOOLS.map((tool) => (
          <button type="button" class="composer-tool" title={tool.title} onClick={() => wrapSelection(tool.before, tool.after)}>
            <Icon name={tool.icon} size={15} />
          </button>
        ))}
        <button type="button" class="composer-tool" title="Link" onClick={insertLink}>
          <Icon name="link" size={15} />
        </button>
        {LINE_TOOLS.map((tool) => (
          <button type="button" class="composer-tool" title={tool.title} onClick={() => prefixLines(tool.linePrefix)}>
            <Icon name={tool.icon} size={15} />
          </button>
        ))}
        <button type="button" class="composer-tool" title="Code block" onClick={() => wrapSelection('```\n', '\n```')}>
          <Icon name="codeBlock" size={15} />
        </button>
      </div>
      <Show when={pendingFiles().length > 0}>
        <div class="composer-file-chips">
          <For each={pendingFiles()}>
            {(file, i) => (
              <span class="composer-file-chip">
                {file.name}
                <button type="button" onClick={() => removeFile(i())} title="Remove">
                  ✕
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>
      <textarea
        ref={textareaRef}
        class="composer-input"
        placeholder={dragOver() ? 'Drop to attach' : placeholder()}
        value={text()}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        rows={1}
        disabled={!targetChannelId() || sending()}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        class="composer-file-input"
        onChange={(e) => {
          if (e.currentTarget.files?.length) addFiles(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
      <div class="composer-footer">
        <button
          type="button"
          class="composer-tool composer-tool-text"
          classList={{ active: toolbarOpen() }}
          title={toolbarOpen() ? 'Hide formatting' : 'Show formatting'}
          onClick={() => setToolbarOpen(!toolbarOpen())}
        >
          Aa
        </button>
        <button type="button" class="composer-tool" title="Attach file" onClick={() => fileInputRef?.click()}>
          <Icon name="attachment" size={16} />
        </button>
        <div class="composer-picker-wrap">
          <button type="button" class="composer-tool" title="Emoji" onClick={() => setEmojiOpen(!emojiOpen())}>
            <Icon name="emoji" size={16} />
          </button>
          {emojiOpen() && (
            <div class="composer-emoji-popover">
              <EmojiPicker
                onSelect={(name) => {
                  recordEmojiUse(name);
                  insertText(`:${name}:`);
                  setEmojiOpen(false);
                }}
                onClose={() => setEmojiOpen(false)}
              />
            </div>
          )}
        </div>
        <div class="composer-picker-wrap">
          <button type="button" class="composer-tool" title="Mention someone" onClick={() => setMentionOpen(!mentionOpen())}>
            <Icon name="mentions" size={16} />
          </button>
          {mentionOpen() && (
            <div class="composer-mention-popover">
              <ComposeUserPicker
                onSelect={(id) => {
                  insertText(`<@${id}> `);
                  setMentionOpen(false);
                }}
                onClose={() => setMentionOpen(false)}
              />
            </div>
          )}
        </div>
        <button
          type="submit"
          class="composer-send"
          disabled={(!text().trim() && pendingFiles().length === 0) || sending()}
          title="Send"
        >
          <Icon name="send" size={15} />
        </button>
      </div>
    </form>
  );
}
