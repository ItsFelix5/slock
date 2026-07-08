import { createSignal, For, Show } from "solid-js";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import Icon from "../../icons";
import {
  browsableChannels,
  browsingChannels,
  closeBrowseChannels,
  createNewChannel,
  joinChannelById,
  searchBrowsableChannels,
} from "../../lib/store";
import "./BrowseChannels.css";

export default function BrowseChannels() {
  const [query, setQuery] = createSignal("");
  const [mode, setMode] = createSignal<"browse" | "create">("browse");
  const [newName, setNewName] = createSignal("");
  const [newPrivate, setNewPrivate] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  useEscapeClose(closeBrowseChannels);

  const onInput = (value: string) => {
    setQuery(value);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchBrowsableChannels(value), 250);
  };

  const submitCreate = async (e: Event) => {
    e.preventDefault();
    const name = newName().trim();
    if (!name) return;
    setCreating(true);
    await createNewChannel(name, newPrivate());
    setCreating(false);
  };

  return (
    <Show when={browsingChannels()}>
      <div
        class="browse-channels-overlay"
        onClick={(e) => e.target === e.currentTarget && closeBrowseChannels()}
      >
        <div class="browse-channels-card">
          <div class="browse-channels-header">
            <div class="browse-channels-tabs">
              <button
                class="browse-channels-tab"
                classList={{ active: mode() === "browse" }}
                onClick={() => setMode("browse")}
              >
                Browse channels
              </button>
              <button
                class="browse-channels-tab"
                classList={{ active: mode() === "create" }}
                onClick={() => setMode("create")}
              >
                Create channel
              </button>
            </div>
            <button class="browse-channels-close" onClick={closeBrowseChannels} title="Close">
              ✕
            </button>
          </div>

          <Show when={mode() === "browse"}>
            <input
              class="browse-channels-search"
              type="text"
              placeholder="Search channels…"
              value={query()}
              onInput={(e) => onInput(e.currentTarget.value)}
              autofocus
            />
            <div class="browse-channels-list">
              <For
                each={browsableChannels()}
                fallback={
                  <div class="browse-channels-empty">
                    {query().trim()
                      ? "No channels found"
                      : "Type to search channels across the workspace"}
                  </div>
                }
              >
                {(c) => (
                  <div class="browse-channels-row">
                    <span class="browse-channels-icon">
                      {c.private ? <Icon name="lock" size={13} /> : "#"}
                    </span>
                    <div class="browse-channels-info">
                      <div class="browse-channels-name">{c.name}</div>
                      <Show when={c.topic}>
                        <div class="browse-channels-topic">{c.topic}</div>
                      </Show>
                    </div>
                    <button class="browse-channels-join" onClick={() => joinChannelById(c.id)}>
                      Join
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={mode() === "create"}>
            <form class="browse-channels-create-form" onSubmit={submitCreate}>
              <label class="browse-channels-label">Name</label>
              <input
                class="browse-channels-search"
                type="text"
                placeholder="e.g. project-launch"
                value={newName()}
                onInput={(e) => setNewName(e.currentTarget.value)}
                autofocus
              />
              <label class="browse-channels-checkbox">
                <input
                  type="checkbox"
                  checked={newPrivate()}
                  onChange={(e) => setNewPrivate(e.currentTarget.checked)}
                />
                Make private
              </label>
              <button
                type="submit"
                class="browse-channels-create-btn"
                disabled={!newName().trim() || creating()}
              >
                {creating() ? "Creating…" : "Create channel"}
              </button>
            </form>
          </Show>
        </div>
      </div>
    </Show>
  );
}
