# Il Brief — daily real estate dashboard (design spec)

**Date:** 2026-06-11
**Owner:** Marcello Barone
**Status:** Approved direction, pending final spec review

## Purpose

A morning dashboard Marcello opens every day — mostly on his Mac, sometimes on his phone during the workday — that keeps him current on the Adelaide real estate market, his farm suburbs, his Italian, and his daily focus. It is the first piece of his "Claude Code as my edge" system.

Go-live constraint: not needed until he starts at the new firm on **1 July 2026**. Build and test during June; daily automation switches on ~30 June.

## What it is (and is not)

- A **static web page** deployed on Vercel, fed by JSON data files in the git repo.
- Fresh content comes from **scheduled Claude agents** that research, write data files, and push commits (Vercel auto-redeploys).
- **No backend, no database, no accounts, no framework.** Vanilla HTML/CSS/JS.
- **100% separate from Ventuno Giorni.** Il Brief lives in its own git repo (`~/Desktop/il-brief`), its own GitHub repo, and its own Vercel project. Ventuno Giorni stays in the `RealEstate-Italian` repo, completely untouched — no shared code, no shared deployment, no merge, ever. (Decision made 2026-06-11, superseding the earlier "promote to root / retire Ventuno" idea, which is cancelled.)

## Visual direction (approved via mockups)

Hybrid of two explored directions: **"Command" dark visuals + "Studio" stacked-card layout.**

- Dark theme: near-black background (#15171B), dark cards (#22252B), light text, muted blue section labels, teal/coral accent numbers.
- Header: "Buongiorno, Marcello" greeting + date + "brief updated H:MMam" freshness stamp.
- Metric tiles (cash rate, clearance rate) at top, then stacked cards in priority order.
- The Italian card gets a teal accent border so it never gets skipped.
- **Mac (primary):** two-column grid — brief content (metrics, market pulse, suburbs) left; personal content (Italian, skill, my day) right. Target: everything visible without scrolling.
- **Phone (secondary):** collapses to a single column in the same priority order.

## Content blocks (priority order)

1. **Metric tiles** — RBA cash rate, Adelaide auction clearance rate. Source: `brief.json`.
2. **Market pulse** — 2–4 sentence overnight summary: Adelaide/SA market news, rate moves, anything an agent should know before work. Source: `brief.json` (daily agent).
3. **My suburbs** — new listings, sales, upcoming auctions in the farm suburbs. Source: `brief.json` (daily agent).
4. **Il Territorio** — interactive isometric farm-area map (see below). Sources: `brief.json` + `stats.json` (no extra agent work).
5. **La frase di oggi** — Italian phrase/drill of the day with translation. Source: `italian.json` rotation (no agent).
6. **Skill of the day** — one script, objection handler, or technique. Source: `skills.json` rotation (no agent).
7. **My day** — editable task checklist, persisted in browser localStorage (key `brief-v1`).

## Il Territorio — farm-area map (approved v2 mockup)

A hand-built isometric 2.5D SVG map of the farm suburbs. Suburb-level activity radar, **not** a per-address pin board (the agent learns suburb-level facts, not reliable coordinates).

- Each suburb in `config.json` is an isometric tile; Athelstone is largest, raised, centered, with a glow halo and accented top face. Dormant suburbs render dim — contrast makes active ones pop.
- Activity dots per suburb from today's `brief.json`: teal = new listing, coral = auction, red = sold. Dots pulse via subtle CSS animation.
- **Click/tap a suburb** → detail panel below the map: weekly stats (median, days on market, trend from `stats.json`) + today's activity lines for that suburb (from `brief.json`). Tap another suburb to swap; all client-side, zero token cost.
- Detail richness varies with what the daily agent's searches surface; the panel must read well with both rich lines and a bare "1 new listing".
- Adding a suburb to `config.json` adds a tile (tile layout positions defined per suburb in config).
- No external map libraries, tiles, or API keys.

## Farm suburbs

Defined in `data/config.json` so the list can change without touching code or agent prompts:

- **Athelstone — primary, always first and most detailed.**
- Initial list: Athelstone, Campbelltown, Newton, Payneham, Norwood.
- Marcello expects to add/remove suburbs over time (e.g. western-suburbs Italian belt); editing `config.json` is the only change needed — agents read it on every run.

## File structure

```
il-brief/              # the whole repo IS the dashboard
  index.html          # page: HTML + CSS + JS, no framework
  data/
    config.json       # farm suburbs (primary flagged), display name, settings
    brief.json        # daily — written by daily brief agent
    stats.json        # weekly — written by weekly stats agent
    italian.json      # pre-built bank, 90+ phrases/drills, date-rotated in browser
    skills.json       # pre-built bank of scripts/techniques, date-rotated in browser
  docs/               # this spec + the implementation plan
```

Deployment: a dedicated Vercel project pointed at the `il-brief` GitHub repo. Served at the project root (`/`). Entirely separate from Ventuno Giorni's repo and deployment — the two never share a project or URL.

## Agents

Token-lean by design: only content that genuinely changes daily is researched daily.

### Daily brief agent
- Scheduled cloud routine, ~5:15am Adelaide time, every day, starting ~30 June.
- Fixed-checklist prompt; **hard cap ~6 web searches**; runs on a cheaper/faster model.
- Tasks: overnight Adelaide/SA market news + rate moves → market pulse; listing/sale/auction activity in config suburbs (Athelstone first) → my suburbs; fill metric tiles.
- Writes `brief.json` in a strict template, validates JSON, commits, pushes.
- If research finds nothing for a section, writes "quiet day" — never invents news.

### Weekly stats agent
- Monday mornings. Refreshes `stats.json`: per-suburb median price, days on market, one-line trend note.

### Zero-token blocks
- `italian.json` and `skills.json` are built once during the build phase from Marcello's existing materials (phrase bank, scripts, study pack). Browser JS picks today's entry by date. No recurring cost.

## Error handling

- Page compares `brief.json` date to today: if stale, show the last brief with a clear "yesterday's brief" banner. Never a broken page.
- Agent validates JSON against the template before pushing; a failed run leaves the previous brief in place.
- Rotation blocks are date-derived and cannot be stale.
- localStorage tasks degrade gracefully if storage is unavailable (checklist just doesn't persist).

## Testing

- Build phase: page developed against realistic sample data; verified locally in browser (desktop + mobile widths, dark rendering, localStorage persistence, stale-brief banner).
- Late June: 2–3 manually triggered agent runs; output quality and JSON validity checked before the schedule goes live.

## Build phases

1. **Mid-June:** build page + rotation banks (`italian.json`, `skills.json`) with sample `brief.json`/`stats.json`. The one big build session.
2. **Mid-June:** deploy to Vercel; Marcello uses it with sample data; tune layout/content.
3. **~27–29 June:** create scheduled agents; manual test runs; quality check.
4. **30 June:** schedule live. **1 July:** first real morning brief.

## Out of scope (for now)

- Live/intraday data, listing-portal API integrations, push notifications.
- Databases, backends, user accounts (graduate later only if the dashboard earns it).
- Progress export/sync (revisit when Ventuno retires and the dashboard becomes the root page).
- Further "edge" ideas (CRM-ish tools, vendor reports, prospecting automation) — separate brainstorms, separate specs.
