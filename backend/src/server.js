import "dotenv/config";
import express from "express";
import cors from "cors";
import { fetchReelsForUsername } from "./apify.js";
import { computeMetricsForUsername } from "./metrics.js";
import { buildWorkbook } from "./excel.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = process.env.APIFY_ACTOR_ID || "apify~instagram-reel-scraper";
const DEFAULT_LIMIT = Number(process.env.DEFAULT_REELS_LIMIT || 12);

if (!APIFY_TOKEN) {
  console.warn(
    "⚠️  APIFY_TOKEN is not set. Copy .env.example to .env and add your Apify API token."
  );
}

// Analyze a batch of handles. Accepts:
// { handles: ["nasa", "dysonusa"], reelsLimit: 12, followerCounts: { nasa: 100000 } }
// followerCounts is optional — only needed if you want the view/follower ratio.
app.post("/analyze", async (req, res) => {
  const { handles, reelsLimit, followerCounts = {} } = req.body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'handles' array." });
  }

  const limit = Number(reelsLimit) || DEFAULT_LIMIT;

  const results = [];
  const errors = [];

  // Sequential on purpose: keeps Apify usage predictable/cheap and avoids
  // hammering the actor with concurrent runs on a free plan.
  for (const handle of handles) {
    try {
      const rawReels = await fetchReelsForUsername(handle, {
        limit,
        token: APIFY_TOKEN,
        actorId: ACTOR_ID,
      });
      const metrics = computeMetricsForUsername(handle, rawReels, {
        followerCount: followerCounts[handle] || null,
      });
      results.push(metrics);
    } catch (err) {
      errors.push({ handle, error: err.message });
    }
  }

  res.json({ results, errors });
});

// Same as /analyze but streams back an .xlsx file directly.
app.post("/analyze/export", async (req, res) => {
  const { handles, reelsLimit, followerCounts = {} } = req.body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'handles' array." });
  }

  const limit = Number(reelsLimit) || DEFAULT_LIMIT;
  const results = [];
  const errors = [];

  for (const handle of handles) {
    try {
      const rawReels = await fetchReelsForUsername(handle, {
        limit,
        token: APIFY_TOKEN,
        actorId: ACTOR_ID,
      });
      const metrics = computeMetricsForUsername(handle, rawReels, {
        followerCount: followerCounts[handle] || null,
      });
      results.push(metrics);
    } catch (err) {
      errors.push({ handle, error: err.message });
    }
  }

  if (results.length === 0) {
    return res.status(502).json({ error: "All handles failed.", errors });
  }

  const workbook = await buildWorkbook(results);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="ig-engagement-report-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`IG Engagement Analyzer backend running on http://localhost:${PORT}`);
});
