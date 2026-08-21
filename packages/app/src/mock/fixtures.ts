// TEMPORARY offline test fixtures. See mock/README.md.
// Raw shapes here match what the real server sends, not the mapped client
// types - the mock router hands these straight to the same client mappers
// the real app uses, so this exercises real code, not a shortcut.

const now = Date.now();
const ts = (minutesAgo: number) => (now / 1000 - minutesAgo * 60).toFixed(6);

export const SELF_ID = "U_SELF";
const ALICE = "U_ALICE";
const BOB = "U_BOB";
const CARA = "U_CARA";
const DAN = "U_DAN";
const EVE = "U_EVE";
const BOT_ID = "B_STANDUP";

export const rawUsers: Record<string, any> = {
  [SELF_ID]: {
    id: SELF_ID,
    name: "felix",
    presence: "active",
    profile: { display_name: "Felix", real_name: "Felix", title: "Engineer" },
    tz_offset: 3600,
  },
  [ALICE]: {
    id: ALICE,
    name: "alice",
    presence: "active",
    profile: {
      display_name: "Alice Chen",
      pronouns: "she/her",
      real_name: "Alice Chen",
      status_emoji: ":coffee:",
      status_text: "brewing",
      title: "Designer",
    },
    tz_offset: 3600,
  },
  [BOB]: {
    id: BOB,
    name: "bob",
    presence: "away",
    profile: { display_name: "Bob Martinez", real_name: "Bob Martinez", title: "Backend" },
    tz_offset: -18000,
  },
  [CARA]: {
    id: CARA,
    name: "cara",
    presence: "active",
    profile: { display_name: "Cara Singh", real_name: "Cara Singh" },
  },
  [DAN]: {
    id: DAN,
    name: "dan",
    presence: "away",
    profile: { display_name: "Dan Osei", real_name: "Dan Osei" },
  },
  [EVE]: {
    id: EVE,
    name: "eve",
    presence: "active",
    profile: { display_name: "Eve Larsson", real_name: "Eve Larsson" },
  },
};

export const CH_GENERAL = "C_GENERAL";
export const CH_RANDOM = "C_RANDOM";
export const CH_ENG = "C_ENG";
export const CH_ANNOUNCE = "C_ANNOUNCE";
export const CH_ARCHIVE = "C_ARCHIVE";
export const DM_ALICE = "D_ALICE";
export const DM_BOB = "D_BOB";
export const MPDM = "G_TRIO";

export const rawBootChannels = [
  {
    created: now / 1000 - 86400 * 40,
    id: CH_GENERAL,
    is_channel: true,
    name: "general",
    properties: {
      tabs: [
        {
          data: { file_id: "F_CANVAS_GENERAL" },
          label: "Canvas",
          type: "canvas",
        },
      ],
    },
    topic: { value: "Company-wide chatter" },
  },
  { created: now / 1000 - 86400 * 40, id: CH_RANDOM, is_channel: true, name: "random", topic: "" },
  {
    created: now / 1000 - 86400 * 30,
    id: CH_ENG,
    is_channel: true,
    is_private: true,
    name: "engineering",
    topic: { value: "Build things, break things, fix things" },
  },
  {
    created: now / 1000 - 86400 * 60,
    id: CH_ANNOUNCE,
    is_channel: true,
    name: "announcements",
    topic: { value: "Read-mostly" },
  },
  {
    created: now / 1000 - 86400 * 400,
    id: CH_ARCHIVE,
    is_archived: true,
    is_channel: true,
    name: "old-project",
    topic: "",
  },
];

export const rawBootIms = [
  { created: now / 1000 - 86400 * 20, id: DM_ALICE, is_open: true, user: ALICE },
  { created: now / 1000 - 86400 * 15, id: DM_BOB, is_open: true, user: BOB },
];

export const rawBootMpims = [
  {
    created: now / 1000 - 86400 * 10,
    id: MPDM,
    is_open: true,
    members: [SELF_ID, CARA, DAN, EVE],
    name: "mpdm-cara--dan--eve-1",
  },
];

// channel id -> messages, oldest first. mock server paginates CH_RANDOM to
// exercise older-history loading; everything else returns in one page.
export const rawMessagesByChannel: Record<string, any[]> = {
  [CH_GENERAL]: [
    {
      reactions: [{ count: 2, name: "wave", users: [ALICE, BOB] }],
      text: `Morning <@${ALICE}> :wave: quick one - can we push the *release* to _Thursday_?`,
      ts: ts(180),
      user: ALICE,
    },
    {
      edited: true,
      text: "Thursday works for me, updating the doc now.",
      ts: ts(170),
      user: SELF_ID,
    },
    {
      bot_id: BOT_ID,
      icons: { image_48: "" },
      metadata: { event_payload: { source_user_id: DAN } },
      text: "Dan updated the release checklist.",
      ts: ts(150),
      username: "Checklist Bot",
    },
    {
      subtype: "at_channel",
      text: `<!channel> reminder standup moved to 10am, ping <@${SELF_ID}> with conflicts`,
      ts: ts(90),
      user: BOB,
      username: "Standup Bot",
      bot_id: BOT_ID,
      icons: {},
    },
    {
      blocks: [
        {
          block_id: "b1",
          elements: [
            {
              elements: [{ text: "Deploy checklist:", type: "text" }],
              type: "rich_text_section",
            },
            {
              elements: [
                { elements: [{ text: "run migrations", type: "text" }], type: "rich_text_section" },
                { elements: [{ text: "flip the flag", type: "text" }], type: "rich_text_section" },
                {
                  elements: [{ text: "watch dashboards", type: "text" }],
                  type: "rich_text_section",
                },
              ],
              style: "bullet",
              type: "rich_text_list",
            },
          ],
          type: "rich_text",
        },
      ],
      text: "Deploy checklist:\n• run migrations\n• flip the flag\n• watch dashboards",
      ts: ts(60),
      user: CARA,
    },
    {
      text: '> quoting the doc: "ship on green"\ninline `code` and a ~strike~ too',
      ts: ts(30),
      user: SELF_ID,
    },
    {
      reactions: [{ count: 1, name: "tada", users: [SELF_ID] }],
      text: `<!date^${Math.floor(now / 1000 + 3600)}^{date_short_pretty} at {time}|later today> works for the retro`,
      ts: ts(5),
      user: ALICE,
    },
  ],
  [CH_ANNOUNCE]: [
    {
      subtype: "at_everyone",
      text: "<!everyone> office closed Friday for the offsite",
      ts: ts(600),
      user: EVE,
    },
    {
      text: "Reminder: expense reports due end of month.",
      ts: ts(200),
      user: EVE,
    },
  ],
  [CH_ENG]: [
    { text: "PR #482 is up, mind taking a look?", ts: ts(240), user: BOB },
    { text: "on it", ts: ts(238), user: SELF_ID },
    {
      reactions: [{ count: 1, name: "eyes", users: [BOB] }],
      text: "left a couple comments, mostly nits",
      ts: ts(220),
      user: SELF_ID,
    },
    { text: "fixed, re-requesting", ts: ts(190), user: BOB },
  ],
  [CH_ARCHIVE]: [{ text: "shipped v1 :tada:", ts: ts(86400 * 200), user: DAN }],
  [DM_ALICE]: [
    { text: "got a sec to look at the mockups?", ts: ts(50), user: ALICE },
    { text: "yep, pulling them up now", ts: ts(48), user: SELF_ID },
  ],
  [DM_BOB]: [{ text: "thanks for the review!", ts: ts(400), user: BOB }],
  [MPDM]: [
    { text: "who's driving the retro doc this week", ts: ts(300), user: CARA },
    { text: "I can", ts: ts(295), user: DAN },
  ],
};

function longHistoryMessages(): any[] {
  const list: any[] = [];
  for (let i = 60; i >= 1; i--) {
    list.push({
      text: `message ${i} - just chatting, nothing to see here`,
      ts: ts(i * 12),
      user: [ALICE, BOB, CARA, DAN, EVE, SELF_ID][i % 6],
    });
  }
  return list;
}
rawMessagesByChannel[CH_RANDOM] = longHistoryMessages();

export const rawActivityItems = [
  {
    feed_ts: String((now / 1000 - 60).toFixed(6)),
    item: {
      message: {
        channel: CH_GENERAL,
        text: `<@${SELF_ID}> can you take a look? :pray:`,
        ts: ts(60),
        user: ALICE,
      },
      type: "at_user",
    },
    key: "act1",
  },
  {
    feed_ts: String((now / 1000 - 90).toFixed(6)),
    item: {
      message: {
        bot_id: BOT_ID,
        icons: {},
        text: "<!channel> reminder standup moved to 10am",
        ts: ts(90),
        user: BOB,
        username: "Standup Bot",
      },
      type: "at_channel",
    },
    key: "act2",
  },
  {
    feed_ts: String((now / 1000 - 30).toFixed(6)),
    item: {
      message: { channel: CH_GENERAL, ts: ts(5), user: SELF_ID },
      reaction: { count: 1, name: "tada", user: ALICE },
      type: "message_reaction",
    },
    key: "act3",
  },
  {
    feed_ts: String((now / 1000 - 220).toFixed(6)),
    item: {
      message: {
        channel: CH_ENG,
        text: "left a couple comments, mostly nits",
        ts: ts(220),
        user: SELF_ID,
      },
      type: "thread_v2",
      bundle_info: {
        payload: {
          thread_entry: {
            channel_id: CH_ENG,
            latest_msg: { text: "fixed, re-requesting", ts: ts(190), user: BOB },
            latest_ts: ts(190),
            thread_ts: ts(220),
            unread_msg_count: 1,
          },
        },
      },
    },
    key: "act4",
  },
];
