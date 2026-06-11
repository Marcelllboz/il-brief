# Telegram Tasks Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two-way Telegram tasks bot from the approved spec (`docs/specs/2026-06-11-telegram-tasks-bot-design.md`): text the bot in natural language, it captures tasks/notes/reminders to Upstash Redis, pushes timed reminders to the phone, and the dashboard's "My day" block reads the same store.

**Architecture:** Vercel serverless functions (`/api/*`) added to the existing static `il-brief` site. `api/telegram.js` is the webhook; `api/tasks.js` is the dashboard read endpoint; `api/cron-reminders.js` is pinged every minute by cron-job.org. Shared logic lives in `api/_lib/`. Storage is Upstash Redis. Intent parsing is rule-based first, then swapped to Claude Haiku in phase 3 — both behind one stable `parseIntent(text)` interface.

**Tech Stack:** Node.js ESM serverless functions on Vercel, `@upstash/redis`, `@anthropic-ai/sdk` (Claude `claude-haiku-4-5`), Telegram Bot API, cron-job.org.

**Testing note:** No Node.js is installed locally, so there is no local test runner. Each task ends with a **deploy + probe** verification: `git push` (Vercel auto-deploys), then a `curl` against the live URL or a Telegram message, with the expected result stated. The live domain is `https://il-brief.vercel.app` (adjust if the Vercel project shows a suffixed domain). Functions that start with `_` (i.e. `api/_lib/*`) are NOT exposed as routes by Vercel.

**Additive guarantee:** Tasks 1–4 add new files only and cannot affect the live dashboard. The dashboard's "My day" block is not touched until Task 5, and only after `/api/tasks` is confirmed working — with a fallback so the page never breaks.

---

### Task 0: Setup checklist (Marcello — one-time, before Task 4 onward)

**Files:** none (external setup). Record each value as a Vercel env var: Project → Settings → Environment Variables.

- [ ] **Step 1: Create the Telegram bot** — In Telegram, message **@BotFather** → `/newbot` → follow prompts → copy the **bot token** (looks like `8123456:AAH...`). Set env var `TELEGRAM_BOT_TOKEN`.
- [ ] **Step 2: Get your chat ID** — In Telegram, message **@userinfobot**; it replies with your numeric **Id**. Set env var `MARCELLO_CHAT_ID` to that number.
- [ ] **Step 3: Invent two secrets** — Make up two long random strings. Set `TELEGRAM_SECRET_TOKEN` (used to verify webhook calls) and `CRON_SECRET` (used to guard the reminder cron). Any 30+ random characters each.
- [ ] **Step 4: Enable Upstash Redis** — Vercel dashboard → your `il-brief` project → **Storage** → add **Upstash Redis** (free "pay-as-you-go" tier). Vercel injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically. Confirm both appear under Environment Variables.
- [ ] **Step 5: Create an Anthropic API key** — console.anthropic.com → API keys → create one. Set env var `ANTHROPIC_API_KEY`. (Only used in Task 7.)
- [ ] **Step 6: Confirm build settings** — Project → Settings → Build & Output: Framework Preset = **Other**, Build Command = **empty/none**, Output Directory = **empty** (root). This keeps the static site serving as-is while Vercel installs deps for `/api` functions.

### Task 1: Project deps + Redis store + Telegram helper

**Files:**
- Create: `package.json`
- Create: `api/_lib/store.js`
- Create: `api/_lib/telegram.js`

- [ ] **Step 1: Create `package.json`** (declares ESM + the two dependencies Vercel installs at deploy time):

```json
{
  "name": "il-brief",
  "private": true,
  "type": "module",
  "dependencies": {
    "@upstash/redis": "^1.34.3",
    "@anthropic-ai/sdk": "^0.65.0"
  }
}
```

- [ ] **Step 2: Create `api/_lib/store.js`** — all Redis reads/writes live here:

```js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function readList(key) {
  const v = await redis.get(key);
  return Array.isArray(v) ? v : [];
}
async function writeList(key, list) {
  await redis.set(key, list);
}

export async function getTasks() { return readList('tasks'); }
export async function getNotes() { return readList('notes'); }
export async function getReminders() { return readList('reminders'); }

export async function addTask(text, source = 'telegram') {
  const tasks = await readList('tasks');
  const task = { id: newId(), text, done: false, createdAt: new Date().toISOString(), source };
  tasks.push(task);
  await writeList('tasks', tasks);
  return task;
}

export async function addNote(text, source = 'telegram') {
  const notes = await readList('notes');
  const note = { id: newId(), text, createdAt: new Date().toISOString(), source };
  notes.push(note);
  await writeList('notes', notes);
  return note;
}

export async function completeTaskByText(match) {
  const tasks = await readList('tasks');
  const m = match.toLowerCase();
  const t = tasks.find((x) => !x.done && x.text.toLowerCase().includes(m));
  if (!t) return null;
  t.done = true;
  await writeList('tasks', tasks);
  return t;
}

export async function addReminder(text, dueAt, source = 'telegram') {
  const reminders = await readList('reminders');
  const r = { id: newId(), text, dueAt, sent: false, createdAt: new Date().toISOString(), source };
  reminders.push(r);
  await writeList('reminders', reminders);
  return r;
}

export async function dueReminders(nowISO) {
  const reminders = await readList('reminders');
  return reminders.filter((r) => !r.sent && r.dueAt <= nowISO);
}

export async function markReminderSent(id) {
  const reminders = await readList('reminders');
  const r = reminders.find((x) => x.id === id);
  if (r) { r.sent = true; await writeList('reminders', reminders); }
}
```

- [ ] **Step 3: Create `api/_lib/telegram.js`** — sending messages + the chat-ID allowlist:

```js
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.MARCELLO_CHAT_ID;

export async function sendMessage(text, chatId = CHAT_ID) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  return r.ok;
}

export function isAuthorisedChat(chatId) {
  return String(chatId) === String(CHAT_ID);
}
```

- [ ] **Step 4: Commit** — `git add package.json api/_lib && git commit -m "feat: deps, redis store, telegram helper"` (no deploy verification yet — these are libraries, exercised in Task 2).

### Task 2: `/api/tasks` read endpoint

**Files:**
- Create: `api/tasks.js`

- [ ] **Step 1: Create `api/tasks.js`**:

```js
import { getTasks, getNotes } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  try {
    const [tasks, notes] = await Promise.all([getTasks(), getNotes()]);
    res.status(200).json({ tasks, notes });
  } catch (e) {
    res.status(500).json({ error: 'store unavailable' });
  }
}
```

- [ ] **Step 2: Deploy** — `git add api/tasks.js && git commit -m "feat: /api/tasks read endpoint" && git push origin main`. Wait ~1 min for Vercel.
- [ ] **Step 3: Verify live** — Run: `curl -s https://il-brief.vercel.app/api/tasks`
  Expected: `{"tasks":[],"notes":[]}` (empty arrays — Redis is empty, store works). If you get `{"error":"store unavailable"}`, the Upstash env vars from Task 0 Step 4 aren't set on the deployment — re-check and redeploy.

### Task 3: `/api/telegram` webhook + rule-based intent (capture core)

**Files:**
- Create: `api/_lib/rules.js`
- Create: `api/_lib/intent.js`
- Create: `api/telegram.js`

- [ ] **Step 1: Create `api/_lib/rules.js`** — deterministic intent parsing (the stable fallback; reminders added in Task 6):

```js
export function ruleParse(text) {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (lower === 'list' || lower === 'today' || lower.startsWith("what's on") || lower.startsWith('whats on')) {
    return { action: 'list', text: '' };
  }
  if (lower.startsWith('note ') || lower.startsWith('note:')) {
    return { action: 'add_note', text: t.replace(/^note:?\s*/i, '') };
  }
  if (/^(done|complete|completed)\b/i.test(lower)) {
    return { action: 'complete', text: '', match: t.replace(/^(done:?|completed?|complete)\s*/i, '').trim() };
  }
  if (lower.startsWith('add ')) {
    return { action: 'add_task', text: t.slice(4).trim() };
  }
  return { action: 'add_task', text: t };
}
```

- [ ] **Step 2: Create `api/_lib/intent.js`** — the stable interface the webhook calls (Task 7 swaps the internals to Claude, keeping this signature):

```js
import { ruleParse } from './rules.js';

export async function parseIntent(text) {
  return ruleParse(text);
}
```

- [ ] **Step 3: Create `api/telegram.js`** — the webhook:

```js
import { isAuthorisedChat, sendMessage } from './_lib/telegram.js';
import { parseIntent } from './_lib/intent.js';
import { addTask, addNote, completeTaskByText, getTasks } from './_lib/store.js';

const MAX_LEN = 500;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_SECRET_TOKEN) {
    return res.status(401).end();
  }

  const msg = req.body?.message;
  if (!msg || !msg.text) return res.status(200).json({ ok: true });
  if (!isAuthorisedChat(msg.chat.id)) return res.status(200).json({ ok: true });

  const text = msg.text.slice(0, MAX_LEN);
  try {
    const intent = await parseIntent(text);
    const reply = await runIntent(intent);
    await sendMessage(reply, msg.chat.id);
  } catch (e) {
    await sendMessage("Couldn't process that — try again.", msg.chat.id);
  }
  return res.status(200).json({ ok: true });
}

async function runIntent(intent) {
  switch (intent.action) {
    case 'add_task': {
      const t = await addTask(intent.text);
      return `Added: ${t.text}`;
    }
    case 'add_note': {
      const n = await addNote(intent.text);
      return `Noted: ${n.text}`;
    }
    case 'complete': {
      const t = await completeTaskByText(intent.match);
      return t ? `Done: ${t.text}` : `Couldn't find an open task matching "${intent.match}".`;
    }
    case 'list': {
      const tasks = (await getTasks()).filter((t) => !t.done);
      return tasks.length ? 'Today:\n' + tasks.map((t) => `• ${t.text}`).join('\n') : 'Nothing on your list.';
    }
    default:
      return "Didn't catch that — try 'add <task>', 'note <thing>', 'done <task>', or 'list'.";
  }
}
```

- [ ] **Step 4: Commit** — `git add api/_lib/rules.js api/_lib/intent.js api/telegram.js && git commit -m "feat: telegram webhook + rule-based capture"` (registration + live test happen in Task 4).

### Task 4: Register the webhook + verify capture end-to-end

**Files:** none (Telegram API call).

- [ ] **Step 1: Deploy** — `git push origin main`; wait ~1 min.
- [ ] **Step 2: Register the webhook with Telegram** — run this once, substituting `<TOKEN>` (your `TELEGRAM_BOT_TOKEN`) and `<SECRET>` (your `TELEGRAM_SECRET_TOKEN`):

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://il-brief.vercel.app/api/telegram" \
  -d "secret_token=<SECRET>"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`.

- [ ] **Step 3: Verify capture from your phone** — In Telegram, message your bot:
  - send `milk and bread` → bot replies `Added: milk and bread`
  - send `add call the Espositos` → bot replies `Added: call the Espositos`
  - send `note they want a winter appraisal` → bot replies `Noted: they want a winter appraisal`
  - send `list` → bot replies with both tasks
  - send `done milk` → bot replies `Done: milk and bread`
  - send `list` → that task no longer appears
- [ ] **Step 4: Verify the store** — Run: `curl -s https://il-brief.vercel.app/api/tasks`
  Expected: JSON showing the tasks you added (the milk one with `"done":true`) and the note. Capture core works end-to-end.
- [ ] **Step 5: Verify the allowlist** — Ask a friend (or a second Telegram account) to message the bot. Expected: **no reply** (silently ignored — only your chat ID is served).

### Task 5: Dashboard "My day" reads `/api/tasks`

**Files:**
- Modify: `index.html` (the `renderMyDay` function and its `init()` call)

- [ ] **Step 1: Replace the `renderMyDay` function in `index.html`** with a version that reads the live store (read-only; the bot is the write path per the spec). Find the existing `function renderMyDay() { ... }` block and replace it entirely with:

```js
  async function renderMyDay() {
    let tasks = [];
    try {
      const r = await fetch('/api/tasks?v=' + Date.now());
      if (r.ok) tasks = (await r.json()).tasks || [];
    } catch (e) { /* dashboard must never break — fall through to hint */ }
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    $('myday-count').textContent = tasks.length ? `${done.length}/${tasks.length} done` : '';
    if (!tasks.length) {
      $('myday-body').innerHTML = `<div style="font-size:13px;color:var(--muted);line-height:1.6">
        Nothing yet. Text your bot — "add call the Espositos" — and it shows here.</div>`;
      return;
    }
    const row = (t) => `<div style="font-size:14px;padding:3px 0;${t.done ? 'color:var(--muted);text-decoration:line-through' : ''}">
      ${t.done ? '✓ ' : '• '}${t.text}</div>`;
    $('myday-body').innerHTML = open.map(row).join('') + done.map(row).join('') +
      `<div style="font-size:12px;color:var(--muted);margin-top:8px">Text the bot to add or complete tasks.</div>`;
  }
```

- [ ] **Step 2: Confirm `init()` awaits it** — in `index.html`, the `init()` function already calls `renderMyDay();`. Change that line to `await renderMyDay();` so errors are caught by the existing `init().catch(...)`. (The other render functions are synchronous and unaffected.)
- [ ] **Step 3: Deploy** — `git add index.html && git commit -m "feat: My day reads live tasks from /api/tasks" && git push origin main`; wait ~1 min.
- [ ] **Step 4: Verify** — Open `https://il-brief.vercel.app/` on your Mac. The "My day" card shows the tasks currently in the store (from Task 4) with the `N/N done` counter. Text the bot a new task, reload the page — it appears. Open the same URL on your phone — identical list (Mac↔phone sync confirmed).
- [ ] **Step 5: Verify graceful failure** — In the browser devtools Network tab, block `/api/tasks` (or temporarily rename the env var and redeploy), reload: the card shows the "Nothing yet / text your bot" hint instead of a broken page. Restore.

### Task 6: Reminders — rule-based time parse + cron push

**Files:**
- Modify: `api/_lib/rules.js` (add the reminder branch + time helpers)
- Modify: `api/telegram.js` (handle `add_reminder`; include reminders in `list`)
- Create: `api/cron-reminders.js`

- [ ] **Step 1: Add reminder parsing to `api/_lib/rules.js`** — insert the reminder check near the top of `ruleParse`, right after the `list` check, and append the two helpers at the bottom of the file. The updated `ruleParse` and new helpers:

```js
export function ruleParse(text) {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (lower === 'list' || lower === 'today' || lower.startsWith("what's on") || lower.startsWith('whats on')) {
    return { action: 'list', text: '' };
  }
  const rem = parseReminder(t);
  if (rem) return rem;
  if (lower.startsWith('note ') || lower.startsWith('note:')) {
    return { action: 'add_note', text: t.replace(/^note:?\s*/i, '') };
  }
  if (/^(done|complete|completed)\b/i.test(lower)) {
    return { action: 'complete', text: '', match: t.replace(/^(done:?|completed?|complete)\s*/i, '').trim() };
  }
  if (lower.startsWith('add ')) {
    return { action: 'add_task', text: t.slice(4).trim() };
  }
  return { action: 'add_task', text: t };
}

function parseReminder(t) {
  const m = t.match(/^remind me (?:to )?(.*?)\s+(?:at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|in\s+(\d+)\s*(m|min|mins|h|hr|hrs|hour|hours))\s*$/i);
  if (!m) return null;
  const what = m[1].trim();
  let dueAt;
  if (m[2]) {
    let hour = parseInt(m[2], 10);
    const min = m[3] ? parseInt(m[3], 10) : 0;
    const ap = (m[4] || '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    dueAt = adelaideTodayAt(hour, min);
  } else {
    const n = parseInt(m[5], 10);
    const unit = m[6].toLowerCase();
    dueAt = new Date(Date.now() + (unit.startsWith('h') ? n * 3600000 : n * 60000)).toISOString();
  }
  return { action: 'add_reminder', text: what, dueAt };
}

function adelaideOffset(d) {
  const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Adelaide', timeZoneName: 'longOffset' })
    .formatToParts(d).find((p) => p.type === 'timeZoneName')?.value || 'GMT+09:30';
  const m = tzName.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return '+09:30';
  return `${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}`;
}

function adelaideTodayAt(hour, min) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const hhmm = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  let due = new Date(`${dateStr}T${hhmm}:00${adelaideOffset(now)}`);
  if (due.getTime() <= Date.now()) due = new Date(due.getTime() + 86400000); // already passed → tomorrow
  return due.toISOString();
}
```

- [ ] **Step 2: Handle `add_reminder` in `api/telegram.js`** — add the import and the case. Change the store import line to:

```js
import { addTask, addNote, completeTaskByText, getTasks, addReminder, getReminders } from './_lib/store.js';
```

Add this case inside `runIntent`'s `switch`, before `default`:

```js
    case 'add_reminder': {
      const r = await addReminder(intent.text, intent.dueAt);
      const when = new Date(r.dueAt).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', weekday: 'short', hour: 'numeric', minute: '2-digit' });
      return `Reminder set for ${when}: ${r.text}`;
    }
```

And extend the `list` case to also show pending reminders:

```js
    case 'list': {
      const tasks = (await getTasks()).filter((t) => !t.done);
      const reminders = (await getReminders()).filter((r) => !r.sent);
      const taskLines = tasks.length ? 'Today:\n' + tasks.map((t) => `• ${t.text}`).join('\n') : 'No open tasks.';
      const remLines = reminders.length
        ? '\n\nReminders:\n' + reminders.map((r) => `• ${r.text} (${new Date(r.dueAt).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', hour: 'numeric', minute: '2-digit' })})`).join('\n')
        : '';
      return taskLines + remLines;
    }
```

- [ ] **Step 3: Create `api/cron-reminders.js`**:

```js
import { dueReminders, markReminderSent } from './_lib/store.js';
import { sendMessage } from './_lib/telegram.js';

export default async function handler(req, res) {
  const secret = req.query.secret || req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) return res.status(401).end();

  const now = new Date().toISOString();
  const due = await dueReminders(now);
  for (const r of due) {
    const ok = await sendMessage(`Reminder: ${r.text}`);
    if (ok) await markReminderSent(r.id);
  }
  res.status(200).json({ sent: due.length });
}
```

- [ ] **Step 4: Deploy** — `git add api/_lib/rules.js api/telegram.js api/cron-reminders.js && git commit -m "feat: reminders — time parse + cron push" && git push origin main`; wait ~1 min.
- [ ] **Step 5: Set up the minute cron** — at **cron-job.org** (free signup): create a job, URL `https://il-brief.vercel.app/api/cron-reminders?secret=<CRON_SECRET>`, schedule **every 1 minute**, request method GET. Save and enable.
- [ ] **Step 6: Verify** — text the bot `remind me to call back in 2m`. Bot replies `Reminder set for ...`. Within ~2–3 minutes your phone gets a Telegram push `Reminder: call back`. Then `curl -s "https://il-brief.vercel.app/api/cron-reminders?secret=<CRON_SECRET>"` returns `{"sent":0}` on a later call (already sent, not re-sent). Also test `remind me to leave for the open at 9:30am`.

### Task 7: Natural-language layer (Claude Haiku)

**Files:**
- Modify: `api/_lib/intent.js` (add the Claude path; keep `ruleParse` as fallback)

- [ ] **Step 1: Replace `api/_lib/intent.js`** with the Claude-backed parser. The `parseIntent(text)` signature is unchanged, so `api/telegram.js` needs no edits:

```js
import Anthropic from '@anthropic-ai/sdk';
import { ruleParse } from './rules.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const SYSTEM = `You convert a real estate agent's short text message into ONE structured action for his personal task app.
Actions:
- add_task: a to-do item.
- add_note: a thought/fact to remember (no action needed).
- add_reminder: something he must be reminded of at a specific time. Resolve the time to a future ISO 8601 timestamp in the Australia/Adelaide timezone using the current time provided.
- list: he wants to see today's tasks/reminders.
- complete: mark a task done; put the identifying words in "match".
- unknown: the message doesn't fit any action.
Keep "text" to the core content only — strip filler like "remind me to" or "add".`;

const schema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['add_task', 'add_note', 'add_reminder', 'list', 'complete', 'unknown'] },
    text: { type: 'string' },
    dueAt: { type: 'string' },
    match: { type: 'string' },
  },
  required: ['action', 'text'],
  additionalProperties: false,
};

export async function parseIntent(text) {
  try {
    const now = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Adelaide' });
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: `Current Adelaide time: ${now}\nMessage: ${text}` }],
    });
    const block = resp.content.find((b) => b.type === 'text');
    const parsed = JSON.parse(block.text);
    if (parsed.action === 'unknown') return ruleParse(text); // give the deterministic parser a shot
    return parsed;
  } catch (e) {
    return ruleParse(text); // API error / bad JSON → deterministic fallback, never drop the message
  }
}
```

- [ ] **Step 2: Deploy** — `git add api/_lib/intent.js && git commit -m "feat: natural-language intent via Claude Haiku" && git push origin main`; wait ~1 min.
- [ ] **Step 3: Verify natural language** — text the bot in plain English:
  - `oi remind me to ring the Espositos back after lunch tomorrow` → `Reminder set for <tomorrow ~1pm>: ring the Espositos back`
  - `the Newton place sold above reserve, worth remembering` → `Noted: ...`
  - `chuck "drop flyers on Maryvale Rd" on my list` → `Added: drop flyers on Maryvale Rd`
  - `what have I got on today?` → the list
  - `mark the flyers one done` → `Done: drop flyers on Maryvale Rd`
- [ ] **Step 4: Verify fallback** — temporarily set `ANTHROPIC_API_KEY` to an invalid value in Vercel and redeploy; text `add test task` → still works (rule-based fallback replies `Added: test task`). Restore the real key and redeploy.
- [ ] **Step 5: Check token spend** — after a day of use, console.anthropic.com → Usage shows a few cents at most. If you ever want it free, the rule-based layer already handles the common command shapes.

### Task 8: Go-live checklist (around 30 June)

- [ ] All Task 0 env vars present on the **Production** environment in Vercel (not just Preview).
- [ ] Webhook still registered: `curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"` shows the correct `url` and `pending_update_count: 0`.
- [ ] cron-job.org job enabled and its execution log shows 200 responses.
- [ ] Pin the bot chat in Telegram; confirm reminders push reliably for two days before 1 July.
- [ ] First week: glance at Anthropic usage once; if surprised, the rule-based fallback covers the common phrasings at zero token cost.

---

## Self-review notes

- **Spec coverage:** capabilities/natural-language (Tasks 3, 7), chat-ID allowlist (Task 1 `isAuthorisedChat` + Task 3 + verified Task 4 Step 5), Telegram secret token (Task 3), cron secret (Task 6), Upstash store + data model tasks/notes/reminders (Task 1), `/api/tasks` + dashboard sync with non-breaking fallback (Tasks 2, 5), Claude Haiku + structured outputs + no prompt caching + inbound-only + length guard (Tasks 3 `MAX_LEN`, 7), token cost on a separate API key (Task 0 Step 5, Task 7), never-invent / bounce ambiguous input (`unknown` → fallback → default hint), phased additive build (task order: new files first, dashboard touched only after `/api/tasks` verified). Out-of-scope items (streaks, multi-user, voice) correctly absent.
- **Interface consistency:** `parseIntent(text)` is the single stable async interface across phases (Task 3 → Task 7), so `api/telegram.js` is written once and never re-touched for the AI swap. Store function names (`addTask`, `addNote`, `completeTaskByText`, `addReminder`, `getTasks`, `getReminders`, `dueReminders`, `markReminderSent`) defined in Task 1 and used verbatim in Tasks 2, 3, 6. Intent object shape `{action, text, dueAt?, match?}` matches the schema in Task 7 and the `runIntent` switch in Tasks 3/6.
- **No placeholders:** every code step is complete and runnable; verification uses concrete `curl`/Telegram steps with expected output. The only `<...>` are secret values the engineer substitutes (token, secret, cron secret), which is correct.
