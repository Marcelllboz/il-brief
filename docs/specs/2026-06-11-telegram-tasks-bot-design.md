# Il Brief — Telegram tasks bot (design spec)

**Date:** 2026-06-11
**Owner:** Marcello Barone
**Status:** Approved direction, pending final spec review
**Parent project:** [Il Brief dashboard](2026-06-11-daily-dashboard-design.md)

## Purpose

A two-way Telegram bot that is Marcello's personal productivity companion — the **personal performance layer** that his work CRM won't cover. He texts the bot in natural language; it captures notes, tasks, and timed reminders, answers "what's on today?", and pushes reminders to his phone. The dashboard's "My day" block reads the same data, so phone and Mac stay in sync.

Deliberately **complements, never duplicates, his work CRM** (which owns client records, the deal pipeline, client-tied follow-ups, and appointments). This layer owns *his* habits, daily targets, quick-capture, and personal reminders.

Go-live target: **1 July 2026**, alongside the dashboard. Built as a fully additive layer — the dashboard works without it and the bot cannot break the dashboard.

## What the user can do (natural language)

- *"the Espositos want a winter appraisal"* → saved to capture inbox
- *"remind me to call them back at 4"* → reminder pushed at 4pm Adelaide
- *"add drop flyers on Maryvale Rd"* → task in My day
- *"what's on today?"* → bot replies with the task/reminder list
- *"done — Italian practice"* → marks it done

No fixed command syntax required; the bot interprets intent.

## Architecture

Static dashboard + a small backend, all on the existing Vercel project for the `il-brief` repo.

```
Telegram  ──webhook──▶  /api/telegram      (Vercel serverless function)
                              │  parse intent (Claude Haiku) → action
                              ▼
                        Upstash Redis        (tasks / notes / reminders store)
                              ▲
   dashboard My day ──fetch── /api/tasks     (read endpoint, JSON)
                              ▲
   cron-job.org ──every 1m──▶ /api/cron-reminders  (scan due → Telegram push)
```

### Components

1. **Telegram bot** — created via BotFather. Bot token stored as a Vercel env var. Webhook registered to `https://<il-brief-domain>/api/telegram`.
2. **`/api/telegram`** (serverless, the "brain") — receives each Telegram update, **authorises by chat ID** (only Marcello's chat ID acts; all others ignored), parses intent via Claude Haiku, performs the action against Redis, replies via Telegram `sendMessage`.
3. **Storage — Upstash Redis** (free tier, via the Vercel integration). Single-user; keys namespaced. Data model:
   - `tasks` → list of `{ id, text, done, createdAt, source }`
   - `notes` → list of `{ id, text, createdAt }` (capture inbox)
   - `reminders` → list of `{ id, text, dueAt (ISO), sent, createdAt }`
4. **`/api/tasks`** (serverless, GET) — returns the current tasks/notes for the dashboard's My day block to render. Replaces the current localStorage-only store; gives Mac↔phone sync.
5. **`/api/cron-reminders`** (serverless, POST, secret-guarded) — pinged every minute by **cron-job.org** (free, 1-minute precision); scans `reminders` for any `dueAt <= now && !sent`, sends each via Telegram, marks `sent`.

### Intent parser (Claude Haiku)

- Model: **`claude-haiku-4-5`** (cheapest; $1/M input, $5/M output).
- **Structured outputs** (`output_config.format` with a json_schema) → guarantees compact, valid JSON, no parsing fragility.
- Intent schema: `{ action: "add_task" | "add_note" | "add_reminder" | "list" | "complete" | "unknown", text: string, dueAt?: string (ISO, Adelaide tz), match?: string }`.
- Tiny fixed system prompt (a few hundred tokens) + the user's one-line message; `max_tokens` ~150.
- **No prompt caching** — Haiku's minimum cacheable prefix is 4096 tokens; our prompt is far smaller, so caching can't engage and padding to reach it would cost more than it saves.
- Called **only on inbound user messages** — never on reads, reminder scans, or dashboard loads. Idle bot = zero tokens.
- Guardrail: messages over a length cap are rejected before the model call, so a pathological message can't trigger a large request.

### Token cost (the user's explicit concern)

Per message: ~300–500 input tokens + ~50–100 output tokens. At Haiku pricing that is well under **US$0.001 per message** — pennies per month even at heavy use. Billed to a **separate Anthropic API key** (its own env var), not Marcello's Claude Code plan, because a 24/7 webhook can't run on the interactive plan.

## Dashboard integration

- "My day" block switches from localStorage to fetching `/api/tasks`; falls back to a friendly "tasks unavailable" state if the API is unreachable (dashboard never breaks).
- The block keeps its existing look (amber spine, done counter). In phase 1 the dashboard renders tasks **read-only** and the bot is the single write path (add/complete via text); a dashboard write endpoint can be added later if desired. This keeps the first build simple and avoids two write paths racing on the same store.

## Security

- **Chat-ID allowlist:** the webhook ignores any update whose `chat.id` ≠ Marcello's. Nobody else can drive the bot even if they find it.
- **Telegram secret token:** the webhook is registered with a secret token; `/api/telegram` rejects requests without the matching header.
- **Cron secret:** `/api/cron-reminders` requires a secret query/header so only cron-job.org can trigger it.
- **No secrets in the repo:** bot token, Anthropic API key, Redis credentials, and the webhook/cron secrets are all Vercel env vars.

## One-time setup (Marcello, ~20 min, guided)

1. Create the bot via Telegram **BotFather**; get the bot token; get his own chat ID.
2. Create an **Anthropic API key** (this carries the tiny pay-per-use bill).
3. Enable **Upstash Redis** via the Vercel integration.
4. Create a free **cron-job.org** job hitting `/api/cron-reminders` every minute.
5. Install the **Telegram** app on his phone (where reminders and replies arrive).

All required values go into Vercel env vars; the implementation plan lists each.

## Error handling

- Unparseable / unknown intent → bot replies asking him to rephrase; nothing is written.
- Claude API error → bot replies "couldn't process that, try again"; no partial write.
- Redis unavailable → bot replies with a transient-error message; dashboard shows the fallback state.
- Reminder send failure → left `sent: false` so the next cron tick retries.
- The bot **never invents or guesses** a task/reminder; ambiguous input is bounced back for clarification.

## Build phases

1. **Capture core** — webhook + chat-ID auth + Redis + `add_task`/`add_note`/`list`/`complete` (command-tolerant), dashboard reads `/api/tasks`. Works end-to-end, no AI yet (rule-based fallback) so the plumbing is proven cheaply.
2. **Reminders** — `add_reminder` + cron scan + push.
3. **Natural-language layer** — swap the rule-based parser for the Claude Haiku intent parser; "just talk to it".
4. **(Later, optional)** — daily 6am "game plan" push from the morning agent; habit targets + streaks.

## Out of scope (for now)

- Habit streaks / daily target counters (phase 4 / separate spec).
- Multi-user, accounts, web login.
- Voice messages, attachments, inline buttons.
- Any client/CRM data — this layer is personal only.
