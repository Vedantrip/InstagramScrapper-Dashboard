# IG Engagement Analyzer

Backend that takes Instagram handles, pulls their recent reels via the Apify
`apify/instagram-reel-scraper` actor, and computes engagement metrics:

- Avg / median reel views
- Avg likes & comments
- Engagement rate (%) = (likes + comments) / views, averaged per reel
- Consistency score (coefficient of variation of views) + a plain-English label
- Posting frequency (avg days between reels)
- View-to-follower ratio (only if you supply follower counts — the reel
  scraper doesn't return follower count itself)
- Flags reels where Instagram hid the like count (`likesCount: -1` in the
  raw data) so they don't silently wreck your averages

Outputs both raw JSON and a downloadable `.xlsx` report (Summary sheet +
per-reel Detail sheet).

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste your Apify API token (Apify Console -> Settings -> Integrations)
npm start
```

Server runs on `http://localhost:4000` by default.

## Endpoints

### `POST /analyze`
Returns JSON metrics for one or more handles.

```json
{
  "handles": ["nasa", "dysonusa"],
  "reelsLimit": 12,
  "followerCounts": { "nasa": 95000000 }
}
```

`reelsLimit` and `followerCounts` are optional.

### `POST /analyze/export`
Same input, but responds with a downloadable `.xlsx` file instead of JSON.

## A note on accuracy

The scraper reads the **logged-out, public** version of a profile — so
numbers can differ slightly from what you see logged into your own account
(private-account engagement is hidden from logged-out viewers), and counts
are a snapshot from the moment of the run, not live. This is normal and
matches how Apify's actor behaves — see their FAQ if numbers look off.

## Frontend dashboard

Plain HTML/CSS/JS, no build step — open `frontend/index.html` in a browser
(or serve it with any static server) while the backend is running.

- Paste one or more handles (comma or newline separated) → "run audit"
- Each handle renders as a readout card: avg/median views, engagement rate,
  post cadence, and a "signal" waveform of recent reel view counts
- The consistency badge is framed as signal-to-noise — teal "consistent" /
  amber "somewhat inconsistent" / red "highly inconsistent"
- "export .xlsx" re-runs the same query through `/analyze/export` and downloads
  the report

By default it talks to `http://localhost:4000`. To point it at a different
backend URL, set `window.__ML_API_BASE__` before `app.js` loads, e.g. add
this in `index.html`:
```html
<script>window.__ML_API_BASE__ = "https://your-deployed-backend.com";</script>
```

## Next steps (not built yet)

- True batch mode at scale (the UI already accepts multiple handles, but for
  50+ handles you'll want a job queue instead of the current sequential loop)
- Caching raw Apify responses so re-running the same handle doesn't re-charge you
- Optional: auto-fetch follower counts via `apify/instagram-profile-scraper`
  so the views/follower ratio doesn't require manual input
