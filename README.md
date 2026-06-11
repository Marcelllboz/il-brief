# Il Brief

Marcello's daily real estate dashboard — a clean, dark morning brief for the workday: market pulse, farm-suburb activity, an isometric "Il Territorio" map, a daily Italian phrase, a skill of the day, and a personal task list.

Standalone project. **Completely separate from the Ventuno Giorni prep dashboard** — its own repo, its own deployment, no shared code.

## Run it locally

```bash
cd ~/Desktop/il-brief
python3 -m http.server 8000
```

Then open **http://localhost:8000/** in a browser. (Press `Ctrl+C` in the terminal to stop.)

## How it works

- Static `index.html` — no framework, no build step.
- Reads five JSON files from `data/`:
  - `config.json` — farm suburb list (edit this to add/remove suburbs; `primary: true` is the flagship).
  - `brief.json` — daily market pulse + suburb activity (written each morning by the scheduled brief agent).
  - `stats.json` — weekly suburb medians / days-on-market / trend (written Mondays by the stats agent).
  - `italian.json`, `skills.json` — pre-built rotation banks; the page picks today's entry by date. No daily cost.
- Tasks in "My day" persist in browser `localStorage` (`brief-v1`).

Design spec and implementation plan live in `docs/`.

## Status

Built June 2026 with sample data. Scheduled agents go live ~30 June; first real brief lands 1 July.
