# Data Centre Watch — automated UK planning feed

This turns `datacentre-watch.html` into a self-updating intelligence hub. Once a day,
GitHub Actions queries the **PlanIt** API (planit.org.uk) for every UK planning
application mentioning a data centre, hyperscale facility, server farm or colocation,
writes the results to a JSON file in your repo, and the page renders them client-side.

No server. No API key. No monthly cost. It all runs inside your existing GitHub Pages repo.

---

## What the four files are

| File | Goes in the repo at | What it does |
|------|--------------------|--------------|
| `scripts/fetch-datacentre.js` | `scripts/fetch-datacentre.js` | Queries PlanIt, writes the JSON |
| `.github/workflows/datacentre-watch.yml` | `.github/workflows/datacentre-watch.yml` | Runs the script daily, commits the data |
| `data/datacentre-applications.json` | `data/datacentre-applications.json` | The data file (starts empty; the Action fills it) |
| `live-section-snippet.html` | *paste into* `datacentre-watch.html` | The visible live feed |

---

## Setup (using your GitHub "Create new file" paste method)

**1. The fetch script**
- In the repo: **Add file → Create new file**
- Filename: `scripts/fetch-datacentre.js` (typing the `scripts/` prefix creates the folder)
- Paste the contents of `fetch-datacentre.js`, commit.

**2. The seed data file**
- **Add file → Create new file**
- Filename: `data/datacentre-applications.json`
- Paste the contents of `datacentre-applications.json`, commit.

**3. The workflow**
- **Add file → Create new file**
- Filename: `.github/workflows/datacentre-watch.yml`
- Paste the contents of `datacentre-watch.yml`, commit.

**4. The live section on the page**
- Open `datacentre-watch.html` (Edit / pencil).
- Paste the entire contents of `live-section-snippet.html` where you want the feed
  to appear — a natural spot is just after your page intro / hero, before the
  existing static content. Commit.

**5. Run it once by hand**
- Go to the repo's **Actions** tab → "Data Centre Watch — daily update" → **Run workflow**.
- Wait ~1–2 minutes. It will fetch live data and commit `data/datacentre-applications.json`.
- Reload `firewalkers.earth/datacentre-watch.html` — the feed should populate.

After that it runs itself every morning (06:17 UTC).

---

## Tuning

- **Keywords:** edit `SEARCH` at the top of `fetch-datacentre.js`. The PlanIt `search`
  syntax supports `"quoted phrases"`, `or`, and a `-` prefix for NOT.
  e.g. add `or "AI growth zone"`, or exclude noise with `-"data cabinet"`.
- **Lookback window:** change `RECENT_DAYS` (currently 365).
- **False positives:** the `looksRelevant()` function does a second-pass filter so the
  word "centre" alone doesn't slip through. Loosen or tighten the regex there.

---

## Notes & honest limits

- **PlanIt covers the UK** (England, Scotland, Wales, Northern Ireland) — ~420 authorities.
  The **Republic of Ireland is not included**; that needs a separate source (An Bord
  Pleanála + local authorities) and is a sensible phase two.
- A keyword match is **not proof** of a data centre. The page says so, and links every
  entry back to the council portal so people can verify.
- PlanIt is rate-limited and free; the script pages gently and backs off on 429s.
  Please keep the daily cadence modest, and consider their donate link — this resource
  depends on it.
- If PlanIt ever changes its API or goes down, the page degrades gracefully (it shows a
  "could not load" message) and the last good JSON stays in the repo.
