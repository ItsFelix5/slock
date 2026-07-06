const PORT = 5174;

const DOMAIN = process.env.SLACK_DOMAIN!;
const TOKEN = process.env.SLACK_TOKEN!;
const COOKIE = process.env.SLACK_COOKIE!;
const ROUTE = process.env.SLACK_ROUTE!;

if (!DOMAIN || !TOKEN || !COOKIE || !ROUTE) {
  throw new Error('Missing SLACK_DOMAIN / SLACK_TOKEN / SLACK_COOKIE / SLACK_ROUTE in .env');
}

async function callSlack(method: string, params: Record<string, string>) {
  const body = new URLSearchParams({ token: TOKEN, ...params });
  const url = `https://${DOMAIN}/api/${method}?slack_route=${encodeURIComponent(ROUTE)}&_x_app_name=client`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: COOKIE,
    },
    body: body.toString(),
  });
  return res.json();
}

const cors = {
  'access-control-allow-origin': 'http://localhost:5173',
  'content-type': 'application/json',
};

let emojiMapPromise: Promise<Record<string, string>> | null = null;

function getEmojiMap() {
  if (!emojiMapPromise) {
    emojiMapPromise = callSlack('emoji.list', {}).then((data) => {
      const raw: Record<string, string> = data.emoji ?? {};
      const resolved: Record<string, string> = {};
      for (const name of Object.keys(raw)) {
        let value = raw[name];
        let hops = 0;
        while (typeof value === 'string' && value.startsWith('alias:') && hops < 5) {
          value = raw[value.slice('alias:'.length)];
          hops++;
        }
        if (typeof value === 'string' && value.startsWith('http')) resolved[name] = value;
      }
      return resolved;
    });
  }
  return emojiMapPromise;
}

Bun.serve({
  hostname: '127.0.0.1',
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    try {
      if (url.pathname === '/api/bootstrap') {
        const [boot, users] = await Promise.all([
          callSlack('client.userBoot', {}),
          callSlack('users.list', { limit: '200' }),
        ]);
        return new Response(JSON.stringify({ boot, users }), { headers: cors });
      }

      if (url.pathname === '/api/history') {
        const channel = url.searchParams.get('channel');
        if (!channel) return new Response('missing channel', { status: 400, headers: cors });
        const data = await callSlack('conversations.history', { channel, limit: '60' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/replies') {
        const channel = url.searchParams.get('channel');
        const ts = url.searchParams.get('ts');
        if (!channel || !ts) return new Response('missing channel/ts', { status: 400, headers: cors });
        const data = await callSlack('conversations.replies', { channel, ts, limit: '200' });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/emoji') {
        const name = url.searchParams.get('name');
        if (!name) return new Response('missing name', { status: 400, headers: cors });
        const map = await getEmojiMap();
        return new Response(JSON.stringify({ ok: true, url: map[name] ?? null }), { headers: cors });
      }

      if (url.pathname === '/api/user') {
        const user = url.searchParams.get('id');
        if (!user) return new Response('missing id', { status: 400, headers: cors });
        const data = await callSlack('users.info', { user });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/send' && req.method === 'POST') {
        const { channel, text, thread_ts } = (await req.json()) as {
          channel: string;
          text: string;
          thread_ts?: string;
        };
        const params: Record<string, string> = { channel, text };
        if (thread_ts) params.thread_ts = thread_ts;
        const data = await callSlack('chat.postMessage', params);
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/edit' && req.method === 'POST') {
        const { channel, ts, text } = (await req.json()) as { channel: string; ts: string; text: string };
        const data = await callSlack('chat.update', { channel, ts, text });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/delete' && req.method === 'POST') {
        const { channel, ts } = (await req.json()) as { channel: string; ts: string };
        const data = await callSlack('chat.delete', { channel, ts });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/react' && req.method === 'POST') {
        const { channel, timestamp, name, remove } = (await req.json()) as {
          channel: string;
          timestamp: string;
          name: string;
          remove?: boolean;
        };
        const data = await callSlack(remove ? 'reactions.remove' : 'reactions.add', {
          channel,
          timestamp,
          name,
        });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      if (url.pathname === '/api/save' && req.method === 'POST') {
        const { channel, ts, remove } = (await req.json()) as {
          channel: string;
          ts: string;
          remove?: boolean;
        };
        const data = await callSlack(remove ? 'saved.delete' : 'saved.add', {
          item_type: 'message',
          item_id: channel,
          ts,
        });
        return new Response(JSON.stringify(data), { headers: cors });
      }

      return new Response('not found', { status: 404, headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 500,
        headers: cors,
      });
    }
  },
});

console.log(`Slack proxy listening on http://localhost:${PORT}`);
