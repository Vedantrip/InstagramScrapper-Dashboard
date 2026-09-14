# IG Engagement Analyzer

Backend that takes Instagram handles, pulls recent reels through Apify, computes performance metrics, and can enrich the result with MountLift Audience Intelligence.

## Performance intelligence

The existing `/analyze` endpoint remains backward compatible and provides:

- Avg / median reel views
- Avg likes & comments
- Engagement rate (%) = (likes + comments) / views, averaged per reel
- Consistency score (coefficient of variation) + label
- Posting frequency (avg days between reels)
- View-to-follower ratio when a follower count is supplied
- Flags for reels where Instagram hid the like count

## Audience intelligence

`POST /analyze/full` adds HypeBridge public-data audience intelligence through the Apify actor:

`hypebridge~influencer-evaluation-agent-instagram-tiktok`

The HypeBridge result is **estimated audience intelligence based on public signals**. It is not official Instagram Insights and should never be represented as such. The unified response uses the labels `estimated`, `Audience Intelligence · Estimated from public signals`, and an explicit confidence value.

The complete raw HypeBridge response is retained under `raw.audience` so the normalizer can evolve as the third-party actor changes.

MountLift also calculates its own proprietary score. The current v1 weighting is:

- Engagement Quality: 30%
- Audience Quality: 25%
- Content Performance: 20%
- Consistency: 15%
- Profile Quality: 10%

This score is independent of any third-party score returned by HypeBridge.

## Setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste your Apify API token
npm start
```

Server runs on `http://localhost:4000` by default.

### Environment

Required:

`APIFY_TOKEN` — existing Apify API token used by the scraper and HypeBridge calls. It must stay server-side.

Optional:

`APIFY_ACTOR_ID` — existing Instagram scraper actor; defaults to `apify~instagram-scraper`.

`HYPEBRIDGE_ACTOR_ID` — audience actor; defaults to `hypebridge~influencer-evaluation-agent-instagram-tiktok`.

`DEFAULT_REELS_LIMIT` — existing reel limit; defaults to `12`.

## Endpoints

### `POST /analyze`

Existing performance-only contract. Input remains compatible:

```json
{
  "handles": ["nasa", "dysonusa"],
  "reelsLimit": 12,
  "followerCounts": { "nasa": 95000000 }
}
```

### `POST /analyze/full`

Returns performance + estimated audience intelligence + MountLift proprietary scores. It reuses the same handles/body pattern as `/analyze` and executes creators sequentially to reduce Apify pressure. A failure in one stage or creator is returned in that creator's `errors` field or the top-level `errors` array rather than aborting the entire batch.

Example shape:

```json
{
  "results": [
    {
      "username": "creator",
      "profile": {
        "followers": 125000,
        "following": 500,
        "posts": 320,
        "verified": false,
        "profileUrl": "https://www.instagram.com/creator/"
      },
      "performance": {
        "avgViews": 36200,
        "medianViews": 29800,
        "avgLikes": 1840,
        "avgComments": 96,
        "engagementRate": 4.8,
        "postingFrequencyDays": 2.4,
        "viewToFollowerRatio": 0.29,
        "consistency": "Consistent"
      },
      "audience": {
        "source": "estimated",
        "label": "Audience Intelligence · Estimated from public signals",
        "confidence": "medium",
        "gender": [],
        "age": [],
        "locations": [],
        "interests": []
      },
      "scores": {
        "engagement": 91,
        "audience": 78,
        "content": 86,
        "consistency": 92,
        "profile": 80,
        "overall": 86,
        "methodology": "MountLift proprietary v1"
      },
      "raw": {
        "performance": {},
        "audience": {}
      }
    }
  ],
  "errors": []
}
```

### `POST /analyze/export`

Existing performance export. Existing columns are preserved, with extra columns available for full-intelligence shaped results.

### `POST /analyze/full/export`

Full-intelligence XLSX export including profile, MountLift scores, audience source/confidence, and the existing reel detail sheet.

## Accuracy / data semantics

The scraper reads the logged-out public version of a profile. Public counts can differ from what is visible to a logged-in account, and results are snapshots at run time.

Audience demographics from HypeBridge are estimates derived from public signals. They are **not official Instagram Insights**. Use `Verified Instagram Insights · Connected via Meta` only once MountLift integrates official Meta/Instagram data.

## Runtime note

The current OpsConsole proxy is configured for a 60-second request window while the scraper uses longer Apify timeouts. `/analyze/full` is intentionally sequential, but multi-creator audience runs can still exceed a 60-second frontend request window depending on actor cold-start time. At larger batch sizes, move full analysis behind a job queue/polling workflow rather than increasing synchronous concurrency.
