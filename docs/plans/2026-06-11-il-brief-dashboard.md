# Il Brief Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "Il Brief" daily real estate dashboard per the approved spec (`docs/superpowers/specs/2026-06-11-daily-dashboard-design.md`): a static dark-themed page at `dashboard/`, fed by agent-written JSON, with the Il Territorio isometric map.

**Architecture:** Static HTML/CSS/JS (no framework, no build step) reading five JSON files from `data/`. Daily and weekly scheduled Claude agents rewrite `brief.json`/`stats.json` and push; Vercel auto-redeploys. Italian/skill blocks rotate client-side by date. Tasks persist in localStorage.

**Tech Stack:** Vanilla HTML/CSS/JS, inline SVG (map), Vercel static hosting, Claude Code scheduled routines (via the `schedule` skill).

**Testing:** No test framework — each task ends with explicit browser verification (`python3 -m http.server` + checks) before commit. Agent tasks are verified with manual triggered runs.

---

### Task 1: Scaffold + config

**Files:**
- Create: `data/config.json`
- Modify: `.vercelignore`

- [ ] **Step 1: Create `data/config.json`**

```json
{
  "owner": "Marcello",
  "timezone": "Australia/Adelaide",
  "suburbs": [
    { "id": "athelstone",   "name": "Athelstone",   "primary": true,  "tile": { "x": 150, "y": 52,  "size": 58 } },
    { "id": "campbelltown", "name": "Campbelltown", "primary": false, "tile": { "x": 64,  "y": 140, "size": 36 } },
    { "id": "newton",       "name": "Newton",       "primary": false, "tile": { "x": 150, "y": 158, "size": 36 } },
    { "id": "payneham",     "name": "Payneham",     "primary": false, "tile": { "x": 232, "y": 128, "size": 30 } },
    { "id": "norwood",      "name": "Norwood",      "primary": false, "tile": { "x": 258, "y": 62,  "size": 30 } }
  ]
}
```

`tile.x/y` are positions in the map's 300×200 SVG viewBox; `size` is the half-width of the isometric diamond. Adding a suburb = adding one object here.

- [ ] **Step 2: Update `.vercelignore`** so the dashboard deploys (it currently deploys only the root `index.html`):

```
*
!index.html
!dashboard/
!dashboard/**
```

- [ ] **Step 3: Commit** — `git add dashboard/ .vercelignore && git commit -m "feat: dashboard scaffold and suburb config"`

### Task 2: Sample data files (the contract the agents must write to)

**Files:**
- Create: `data/brief.json`, `data/stats.json`

- [ ] **Step 1: Create `data/brief.json`** with realistic sample content. This exact schema is what the daily agent must produce — every key shown is required; `lines` may be `[]`; set the sample `date` to the build day so the page renders fresh during development:

```json
{
  "date": "2026-06-12",
  "generatedAt": "2026-06-12T05:32:00+09:30",
  "metrics": { "cashRate": "3.85%", "clearance": "68%" },
  "marketPulse": "RBA held the cash rate at 3.85% yesterday. CoreLogic notes Adelaide values up 0.4% for May, led by the north-east. Winter listing volumes are thin — motivated vendors face less competition, a useful prospecting angle this week.",
  "suburbs": {
    "athelstone":   { "counts": { "new": 2, "auction": 1, "sold": 0 }, "lines": ["New: 3BR family home near Thorndon Park, listed Tue", "New: 2BR townhouse on Gorge Rd", "Auction Sat 11:00am — watch the result for comps"] },
    "campbelltown": { "counts": { "new": 1, "auction": 0, "sold": 0 }, "lines": ["New: renovated villa, char appeal, mid-$900s guide"] },
    "newton":       { "counts": { "new": 0, "auction": 0, "sold": 1 }, "lines": ["Sold: 4BR on Montacute Rd, settled above reserve"] },
    "payneham":     { "counts": { "new": 0, "auction": 0, "sold": 0 }, "lines": [] },
    "norwood":      { "counts": { "new": 0, "auction": 0, "sold": 0 }, "lines": [] }
  }
}
```

- [ ] **Step 2: Create `data/stats.json`** (the weekly agent's contract):

```json
{
  "weekOf": "2026-06-08",
  "suburbs": {
    "athelstone":   { "median": "$1.02M", "daysOnMarket": 31, "trend": "warm",   "note": "Tight stock; family homes moving fastest" },
    "campbelltown": { "median": "$985k",  "daysOnMarket": 35, "trend": "steady", "note": "Villas outperforming units" },
    "newton":       { "median": "$940k",  "daysOnMarket": 38, "trend": "steady", "note": "Downsizer demand holding prices" },
    "payneham":     { "median": "$1.05M", "daysOnMarket": 33, "trend": "warm",   "note": "Character homes drawing eastern-suburbs buyers" },
    "norwood":      { "median": "$1.45M", "daysOnMarket": 41, "trend": "cool",   "note": "Premium segment slower over winter" }
  }
}
```

`trend` is one of `"warm" | "steady" | "cool"` (page renders ▲ teal / ▶ gray / ▼ coral).

- [ ] **Step 3: Validate and commit** — `python3 -c "import json;[json.load(open(f)) for f in ['data/brief.json','data/stats.json','data/config.json']]"` (expect no output), then `git add dashboard/data && git commit -m "feat: sample brief and stats data"`

### Task 3: Rotation banks

**Files:**
- Create: `data/italian.json`, `data/skills.json`

- [ ] **Step 1: Create `data/italian.json`.** Source the content from `02-ITALIAN-PHRASE-BANK.md` and `01-SA-REAL-ESTATE-STUDY-PACK.md` (real-estate-relevant phrases first, general conversational fill after). **Minimum 90 entries.** Schema (array order is the rotation order):

```json
{
  "entries": [
    { "it": "Questa casa ha molto potenziale", "en": "This house has a lot of potential", "drill": "Say it aloud 3×, then swap in: giardino (garden), cucina (kitchen)" }
  ]
}
```

Every entry must have all three keys; `drill` is one actionable line, not a lesson.

- [ ] **Step 2: Create `data/skills.json`.** Source from `03-SCRIPTS.md` plus standard objection/technique repertoire. **Minimum 60 entries**, schema:

```json
{
  "entries": [
    { "title": "Handling \"we'll wait until spring\"", "body": "Acknowledge, then reframe scarcity: \"Most owners think that — which is exactly why serious buyers have less to choose from right now. Spring brings competition, winter brings attention.\" Close with offering a no-pressure appraisal." }
  ]
}
```

`body` ≤ 60 words — it must fit a dashboard card, not a training manual.

- [ ] **Step 3: Verify counts and commit** — `python3 -c "import json;print(len(json.load(open('data/italian.json'))['entries']), len(json.load(open('data/skills.json'))['entries']))"` (expect `>=90 >=60`), then commit `feat: italian and skills rotation banks`.

### Task 4: Page shell, theme, data loading

**Files:**
- Create: `index.html`

- [ ] **Step 1: Write the shell.** Single file; structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Il Brief</title>
  <style>
    :root { --bg:#15171B; --card:#22252B; --card-raise:#2E333C; --text:#E8E8E6;
            --muted:#888780; --dim:#B4B2A9; --label:#85B7EB; --teal:#9FE1CB;
            --teal-deep:#5DCAA5; --coral:#F0997B; --red:#F09595; }
    * { box-sizing:border-box; margin:0; }
    body { background:var(--bg); color:var(--text);
           font:16px/1.6 -apple-system, "Segoe UI", Roboto, sans-serif; padding:24px; }
    .wrap { max-width:980px; margin:0 auto; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:18px; }
    .col { display:flex; flex-direction:column; gap:10px; }
    .card { background:var(--card); border-radius:12px; padding:14px 16px; }
    .label { font-size:11px; letter-spacing:0.5px; color:var(--label);
             text-transform:uppercase; margin-bottom:6px; }
    .tiles { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .stale { background:#3A2E1E; color:#FAC775; border-radius:10px;
             padding:10px 14px; font-size:13px; margin-top:12px; display:none; }
    @media (max-width:760px) { .grid { grid-template-columns:1fr; } body { padding:14px; } }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.45 } }
    .dot-ring { animation:pulse 2.4s ease-in-out infinite; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1 id="greeting" style="font-size:24px;font-weight:500">Buongiorno, Marcello</h1>
      <p id="datestamp" style="font-size:13px;color:var(--muted)"></p>
    </header>
    <div id="stale" class="stale">Showing yesterday's brief — today's update hasn't arrived yet.</div>
    <div class="grid">
      <div class="col" id="col-left">
        <div class="tiles" id="tiles"></div>
        <div class="card" id="pulse"><div class="label">Market pulse</div><div id="pulse-body"></div></div>
        <div class="card" id="suburbs"><div class="label">My suburbs</div><div id="suburbs-body"></div></div>
        <div class="card" id="territorio"><div class="label">Il Territorio</div>
          <div id="map-holder"></div><div id="detail-holder"></div></div>
      </div>
      <div class="col" id="col-right">
        <div class="card" id="frase" style="border-left:3px solid var(--teal-deep);border-radius:0 12px 12px 0">
          <div class="label" style="color:var(--teal)">La frase di oggi</div><div id="frase-body"></div></div>
        <div class="card" id="skill"><div class="label">Skill of the day</div><div id="skill-body"></div></div>
        <div class="card" id="myday"><div class="label">My day</div><div id="myday-body"></div></div>
      </div>
    </div>
  </div>
  <script>
  const $ = id => document.getElementById(id);
  const fmtDay = d => d.toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long', timeZone:'Australia/Adelaide' });
  const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone:'Australia/Adelaide' });
  const daysSinceEpoch = () => Math.floor(Date.parse(todayISO()) / 86400000);

  async function load(name) {
    const r = await fetch(`data/${name}.json?v=${Date.now()}`);
    if (!r.ok) throw new Error(`${name}.json ${r.status}`);
    return r.json();
  }

  async function init() {
    const [config, brief, stats, italian, skills] = await Promise.all(
      ['config','brief','stats','italian','skills'].map(load));
    renderHeader(brief);
    renderTiles(brief);
    renderPulse(brief);
    renderSuburbs(config, brief);
    renderMap(config, brief, stats);
    renderRotation(italian, skills);
    renderMyDay();
  }
  init().catch(e => { $('stale').style.display = 'block'; $('stale').textContent = 'Could not load brief data: ' + e.message; });
  </script>
</body>
</html>
```

The six `render*` functions are defined in Tasks 5–7 — append each inside the same `<script>` block above `init()`.

- [ ] **Step 2: Verify shell loads** — `python3 -m http.server 8901 -d ~/Desktop/RE` then open `http://localhost:8901/dashboard/`. Expected at this point: dark page, greeting, and the stale banner showing a `renderHeader is not defined` error (functions not written yet). That confirms loading + error path work.

- [ ] **Step 3: Commit** — `feat: dashboard shell, theme, data loading`

### Task 5: Header, tiles, pulse, suburbs renderers

**Files:**
- Modify: `index.html` (script block)

- [ ] **Step 1: Add the four renderers**

```js
function renderHeader(brief) {
  const now = new Date();
  const hr = Number(now.toLocaleString('en-AU', { hour:'numeric', hour12:false, timeZone:'Australia/Adelaide' }));
  $('greeting').textContent = (hr < 12 ? 'Buongiorno' : hr < 18 ? 'Buon pomeriggio' : 'Buonasera') + ', Marcello';
  const upd = new Date(brief.generatedAt).toLocaleTimeString('en-AU',
    { hour:'numeric', minute:'2-digit', timeZone:'Australia/Adelaide' });
  $('datestamp').textContent = `${fmtDay(now)} · brief updated ${upd}`;
  if (brief.date !== todayISO()) $('stale').style.display = 'block';
}

function renderTiles(brief) {
  $('tiles').innerHTML = `
    <div class="card"><div class="label" style="color:var(--muted)">Cash rate</div>
      <div style="font-size:22px;font-weight:500">${brief.metrics.cashRate}</div></div>
    <div class="card"><div class="label" style="color:var(--muted)">Clearance</div>
      <div style="font-size:22px;font-weight:500;color:var(--teal)">${brief.metrics.clearance}</div></div>`;
}

function renderPulse(brief) {
  $('pulse-body').textContent = brief.marketPulse;
  $('pulse-body').style.fontSize = '14px';
}

function renderSuburbs(config, brief) {
  const rows = config.suburbs.map(s => {
    const d = brief.suburbs[s.id] || { counts:{new:0,auction:0,sold:0}, lines:[] };
    const bits = [];
    if (d.counts.new) bits.push(`${d.counts.new} new`);
    if (d.counts.auction) bits.push(`${d.counts.auction} auction`);
    if (d.counts.sold) bits.push(`${d.counts.sold} sold`);
    return `<div style="display:flex;justify-content:space-between;font-size:14px;padding:3px 0">
      <span style="${s.primary ? 'font-weight:500' : 'color:var(--dim)'}">${s.name}</span>
      <span style="color:${bits.length ? 'var(--teal)' : 'var(--muted)'}">${bits.join(' · ') || 'quiet'}</span></div>`;
  });
  $('suburbs-body').innerHTML = rows.join('');
}
```

- [ ] **Step 2: Verify in browser** — reload `http://localhost:8901/dashboard/`. Expected: greeting matches time of day, two metric tiles, pulse paragraph, five suburb rows with Athelstone bold and active suburbs in teal. Change `date` in `brief.json` to `2026-01-01`, reload, expect amber stale banner; change it back.

- [ ] **Step 3: Commit** — `feat: header, metric tiles, pulse and suburbs blocks`

### Task 6: Il Territorio map + detail panel

**Files:**
- Modify: `index.html` (script block)

- [ ] **Step 1: Add map renderer.** Tiles are isometric diamonds generated from config; activity dots come from `brief.suburbs[id].counts` (order: new=teal, auction=coral, sold=red; one dot per count, max 5 dots, spread across the tile top face). Primary suburb gets halo + raised edges + stroke.

```js
function renderMap(config, brief, stats) {
  const dotSpots = [[-14,-6],[16,2],[2,-16],[-2,10],[18,-10]];
  const tiles = config.suburbs.map(s => {
    const d = brief.suburbs[s.id] || { counts:{new:0,auction:0,sold:0}, lines:[] };
    const z = s.size ?? s.tile.size, t = s.tile;
    const colors = [...Array(d.counts.new).fill('var(--teal)'),
                    ...Array(d.counts.auction).fill('var(--coral)'),
                    ...Array(d.counts.sold).fill('var(--red)')].slice(0, 5);
    const active = colors.length > 0;
    const dots = colors.map((c, i) => {
      const [dx, dy] = dotSpots[i].map(v => v * z / 58);
      return `<circle class="dot-ring" cx="${dx}" cy="${dy}" r="${z/9+3}" fill="${c}" opacity="0.25"/>
              <circle cx="${dx}" cy="${dy}" r="${z/14+2}" fill="${c}"/>`;
    }).join('');
    const h = z * 0.55;
    const prim = s.primary;
    return `<g transform="translate(${t.x},${t.y})" style="cursor:pointer" onclick="showDetail('${s.id}')">
      ${prim ? `<ellipse cx="0" cy="${h*0.3}" rx="${z*1.25}" ry="${z*0.6}" fill="var(--teal-deep)" opacity="0.10"/>` : ''}
      <polygon points="-${z},${h*0.12} 0,${h} 0,${h+10} -${z},${h*0.12+10}" fill="#1F2228"/>
      <polygon points="${z},${h*0.12} 0,${h} 0,${h+10} ${z},${h*0.12+10}" fill="#262A31"/>
      <polygon points="0,-${h} ${z},${h*0.12} 0,${h} -${z},${h*0.12}"
        fill="${prim ? 'var(--card-raise)' : (active ? '#22252B' : '#1C1F24')}"
        stroke="${prim ? 'var(--teal-deep)' : (active ? '#4A4E56' : '#3A3E46')}" stroke-width="${prim ? 2 : 1}"/>
      ${dots}
      <text x="0" y="${h+24}" text-anchor="middle" fill="${prim ? 'var(--text)' : (active ? 'var(--dim)' : '#777670')}"
        font-size="${prim ? 11 : 9}" ${prim ? 'font-weight="500"' : ''}>${s.name}</text></g>`;
  });
  $('map-holder').innerHTML =
    `<svg viewBox="0 0 300 200" style="width:100%">${tiles.join('')}</svg>
     <div style="font-size:10px;color:var(--muted);text-align:right">tap a suburb for details</div>`;
  window.__territorio = { config, brief, stats };
}

function showDetail(id) {
  const { config, brief, stats } = window.__territorio;
  const s = config.suburbs.find(x => x.id === id);
  const d = brief.suburbs[id] || { lines: [] };
  const w = (stats.suburbs || {})[id];
  const trendGlyph = { warm:['▲','var(--teal)'], steady:['▶','var(--muted)'], cool:['▼','var(--coral)'] }[w?.trend] || ['▶','var(--muted)'];
  $('detail-holder').innerHTML = `
    <div style="background:var(--card-raise);border:1px solid var(--teal-deep);border-radius:10px;padding:12px;margin-top:8px">
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:500">${s.name}</span>
        <span style="color:var(--muted);font-size:12px;cursor:pointer" onclick="$('detail-holder').innerHTML=''">✕ close</span></div>
      ${w ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;font-size:13px">
        <div><div class="label" style="color:var(--muted)">Median</div>${w.median}</div>
        <div><div class="label" style="color:var(--muted)">Days on mkt</div>${w.daysOnMarket}</div>
        <div><div class="label" style="color:var(--muted)">Trend</div><span style="color:${trendGlyph[1]}">${trendGlyph[0]} ${w.trend}</span></div></div>
        <div style="font-size:12px;color:var(--dim);margin-top:6px">${w.note}</div>` : ''}
      <div style="font-size:13px;color:var(--dim);margin-top:8px">
        ${d.lines.length ? d.lines.map(l => `● ${l}`).join('<br>') : 'Quiet day — no new activity.'}</div></div>`;
}
```

- [ ] **Step 2: Verify in browser** — reload. Expected: five isometric tiles, Athelstone large/raised/glowing with 3 pulsing dots, Newton one red dot. Click Athelstone → detail panel with median/DOM/trend + 3 activity lines; click Payneham → "Quiet day" panel; ✕ closes. Resize to 375px width — map scales, panel readable.

- [ ] **Step 3: Commit** — `feat: Il Territorio isometric map with detail panel`

### Task 7: Rotations + My day checklist

**Files:**
- Modify: `index.html` (script block)

- [ ] **Step 1: Add renderers**

```js
function renderRotation(italian, skills) {
  const n = daysSinceEpoch();
  const fr = italian.entries[n % italian.entries.length];
  $('frase-body').innerHTML = `<div style="font-style:italic;font-size:16px">«${fr.it}»</div>
    <div style="font-size:13px;color:var(--muted);margin-top:2px">${fr.en}</div>
    <div style="font-size:12px;color:var(--dim);margin-top:6px">${fr.drill}</div>`;
  const sk = skills.entries[n % skills.entries.length];
  $('skill-body').innerHTML = `<div style="font-weight:500;font-size:14px">${sk.title}</div>
    <div style="font-size:13px;color:var(--dim);margin-top:4px">${sk.body}</div>`;
}

function renderMyDay() {
  const KEY = 'brief-v1';
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { state = {}; }
  if (state.date !== todayISO()) state = { date: todayISO(), tasks: (state.tasks || []).map(t => ({ ...t, done:false })) };
  if (!state.tasks) state.tasks = [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const draw = () => {
    $('myday-body').innerHTML = state.tasks.map((t, i) =>
      `<label style="display:flex;gap:8px;font-size:14px;padding:3px 0;${t.done ? 'color:var(--muted);text-decoration:line-through' : ''}">
        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="__toggleTask(${i})"> ${t.text}</label>`).join('') +
      `<form onsubmit="return __addTask(this)" style="margin-top:8px;display:flex;gap:6px">
        <input name="t" placeholder="Add a task…" style="flex:1;background:var(--bg);border:1px solid #3A3E46;border-radius:8px;color:var(--text);padding:6px 10px;font-size:13px">
        <button style="background:var(--card-raise);border:1px solid #3A3E46;border-radius:8px;color:var(--text);padding:6px 12px;cursor:pointer">+</button></form>`;
  };
  window.__toggleTask = i => { state.tasks[i].done = !state.tasks[i].done; save(); draw(); };
  window.__addTask = f => { const v = f.t.value.trim(); if (v) { state.tasks.push({ text:v, done:false }); save(); draw(); } return false; };
  save(); draw();
}
```

Task list carries over day to day but checkboxes reset each morning (it's a daily routine list, not a todo archive).

- [ ] **Step 2: Verify in browser** — reload. Expected: Italian phrase + skill cards filled; add two tasks, tick one, hard-reload — tasks persist, tick state persists same-day. In DevTools console run `localStorage.getItem('brief-v1')` and confirm JSON shape.

- [ ] **Step 3: Full-page check** — Mac width: two columns, no scroll needed on a 13" display at default zoom. 375px width: single column, order = tiles, pulse, suburbs, map, frase, skill, my day.

- [ ] **Step 4: Commit** — `feat: rotation blocks and My day checklist`

### Task 8: Deploy to Vercel

**Files:** none (deployment)

- [ ] **Step 1: Push** — `git push origin main`.
- [ ] **Step 2: Verify deploy** — open `https://<existing-vercel-domain>/dashboard/` on the Mac. Expected: full dashboard renders; root URL still shows Ventuno Giorni untouched. If `dashboard/` 404s, check the `.vercelignore` rules from Task 1 in the Vercel build output.
- [ ] **Step 3: Phone check** — Marcello opens the same URL on his phone; single column, map tappable.
- [ ] **Step 4 (manual, Marcello):** bookmark on Mac, add to phone home screen.

### Task 9: Scheduled agents (execute ~27–29 June, NOT before)

**Files:** none (routines via the `schedule` skill)

- [ ] **Step 1: Create the daily brief routine** with the `schedule` skill: daily at **5:15am Australia/Adelaide**, cheaper/faster model, prompt:

```
You maintain data/brief.json in this repo. Read data/config.json for the suburb list.
Hard limit: at most 6 web searches total. Do not browse beyond search results you need.
1. Search for Adelaide / South Australia residential property news from the last 24h and the current RBA cash rate and latest Adelaide auction clearance rate.
2. Search for new listings, sales, or upcoming auctions in the config suburbs, prioritising the suburb marked "primary".
3. Rewrite data/brief.json EXACTLY matching its existing schema: date (today, Australia/Adelaide, YYYY-MM-DD), generatedAt (ISO 8601 with +09:30), metrics.cashRate, metrics.clearance, marketPulse (2-4 sentences, written for a young sales agent, end with one practical angle for the day), suburbs.<id>.counts {new, auction, sold} and suburbs.<id>.lines (short factual lines; [] if nothing found — NEVER invent listings or results).
4. Validate the JSON parses. Commit "brief: <date>" and push.
If a value can't be found, keep yesterday's metric values and note "quiet day" in lines. Total work should stay small — this is a fill-in-the-template job, not research.
```

- [ ] **Step 2: Create the weekly stats routine**: Mondays **5:45am Australia/Adelaide**, prompt:

```
You maintain data/stats.json. Read data/config.json for suburbs.
Hard limit: 6 web searches. For each suburb find: median house price, average days on market, and write a one-line trend note. Set trend to exactly one of "warm" | "steady" | "cool" based on the data found.
Rewrite stats.json matching its existing schema exactly (weekOf = this week's Monday, YYYY-MM-DD). Keep last week's value for anything not found. Validate JSON, commit "stats: week of <date>", push.
```

- [ ] **Step 3: Manual test runs** — trigger the daily routine manually 2–3 times across 27–29 June. After each run: `git pull`, check `brief.json` parses, date is correct, no invented listings (spot-check one claimed listing via a quick search), and the live page renders it. Trigger the weekly routine once and check `stats.json` the same way.

- [ ] **Step 4: Confirm schedules active for 30 June** — first real brief lands 1 July.

### Task 10: Go-live checklist (30 June)

- [ ] Ventuno Giorni complete → promote dashboard: move root `index.html` to `ventuno.html`, copy `index.html` route or add a root redirect — decide at the time with Marcello, then update `.vercelignore` accordingly and push.
- [ ] Morning of 1 July: verify the 5:15am brief landed (page shows "brief updated 5:1xam", no stale banner).
- [ ] First week: watch daily token usage; if heavy, drop the daily routine to weekdays-only.

---

## Self-review notes

- Spec coverage: all seven blocks (Tasks 4–7), agents + caps + templates (Task 9), error handling (stale banner Task 5, fetch failure Task 4, localStorage try/catch Task 7, "never invent" rule in agent prompts), Vercel separation (Tasks 1, 8), Athelstone primacy (config flag drives map size, bolding, agent priority), config-driven suburbs (Task 1).
- Naming consistency: `brief-v1`, `showDetail`, `renderMap` signatures match across tasks; `s.size ?? s.tile.size` guard in Task 6 covers both config shapes — config uses `tile.size`, so the fallback path is the live one.
- Out of scope honored: no backend, no map libraries, no push notifications.
