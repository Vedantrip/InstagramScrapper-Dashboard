import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { fetchReelsForUsername } from "./apify.js";
import { fetchAudienceForUsername, HYPEBRIDGE_DEFAULT_ACTOR_ID } from "./audience.js";
import { computeMetricsForUsername } from "./metrics.js";
import { normalizeFullIntelligence } from "./intelligence.js";
import { calculateMountLiftScore } from "./score.js";
import { buildWorkbook } from "./excel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = process.env.PORT || 4000;
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const ACTOR_ID = process.env.APIFY_ACTOR_ID || "apify~instagram-scraper";
const HYPEBRIDGE_ACTOR_ID = process.env.HYPEBRIDGE_ACTOR_ID || HYPEBRIDGE_DEFAULT_ACTOR_ID;
const DEFAULT_LIMIT = Number(process.env.DEFAULT_REELS_LIMIT || 12);

if (!APIFY_TOKEN) {
  console.warn("⚠️  APIFY_TOKEN is not set. Copy .env.example to .env and add your Apify API token.");
}

function cleanHandle(value) {
  return String(value || "").trim().replace(/^@/, "");
}

async function analyzePerformance(handle, limit, followerCounts) {
  const rawReels = await fetchReelsForUsername(handle, {
    limit,
    token: APIFY_TOKEN,
    actorId: ACTOR_ID,
  });
  return computeMetricsForUsername(handle, rawReels, {
    followerCount: followerCounts[handle] || null,
  });
}

app.post("/analyze", async (req, res) => {
  const { handles, reelsLimit, followerCounts = {} } = req.body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'handles' array." });
  }

  const limit = Number(reelsLimit) || DEFAULT_LIMIT;
  const results = [];
  const errors = [];

  for (const rawHandle of handles) {
    const handle = cleanHandle(rawHandle);
    try {
      const metrics = await analyzePerformance(handle, limit, followerCounts);
      results.push(metrics);
    } catch (err) {
      errors.push({ handle, error: err.message });
    }
  }

  res.json({ results, errors });
});

app.post("/analyze/full", async (req, res) => {
  const { handles, reelsLimit, followerCounts = {} } = req.body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'handles' array." });
  }
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "APIFY_TOKEN is not configured on the scraper service." });
  }

  const limit = Number(reelsLimit) || DEFAULT_LIMIT;
  const results = [];
  const errors = [];

  // Keep HypeBridge calls sequential: these evaluations can be materially
  // slower than reel scraping and concurrent actor runs add avoidable pressure.
  for (const rawHandle of handles) {
    const handle = cleanHandle(rawHandle);
    if (!handle) {
      errors.push({ handle: rawHandle, stage: "validation", error: "Username is required." });
      continue;
    }

    let performance = null;
    let audienceRaw = null;
    let performanceError = null;
    let audienceError = null;

    try {
      performance = await analyzePerformance(handle, limit, followerCounts);
    } catch (err) {
      performanceError = err.message;
    }

    try {
      audienceRaw = await fetchAudienceForUsername(handle, {
        token: APIFY_TOKEN,
        actorId: HYPEBRIDGE_ACTOR_ID,
      });
    } catch (err) {
      audienceError = err.message;
    }

    if (!performance && !audienceRaw) {
      errors.push({
        handle,
        stage: "full-analysis",
        error: "Both performance and audience analysis failed.",
        performanceError,
        audienceError,
      });
      continue;
    }

    const normalized = normalizeFullIntelligence({
      username: handle,
      performance: performance || {},
      audienceRaw: audienceRaw || {},
    });

    normalized.errors = {};
    if (performanceError) normalized.errors.performance = performanceError;
    if (audienceError) normalized.errors.audience = audienceError;
    normalized.scores = calculateMountLiftScore(normalized);
    normalized.raw = { performance, audience: audienceRaw };

    results.push(normalized);
  }

  res.json({ results, errors });
});

app.post("/analyze/export", async (req, res) => {
  const { handles, reelsLimit, followerCounts = {} } = req.body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'handles' array." });
  }

  const limit = Number(reelsLimit) || DEFAULT_LIMIT;
  const results = [];
  const errors = [];

  for (const rawHandle of handles) {
    const handle = cleanHandle(rawHandle);
    try {
      const metrics = await analyzePerformance(handle, limit, followerCounts);
      results.push(metrics);
    } catch (err) {
      errors.push({ handle, error: err.message });
    }
  }

  if (results.length === 0) {
    return res.status(502).json({ error: "All handles failed.", errors });
  }

  const workbook = await buildWorkbook(results);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="ig-engagement-report-${Date.now()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

app.post("/analyze/full/export", async (req, res) => {
  const { handles, reelsLimit, followerCounts = {} } = req.body || {};

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'handles' array." });
  }
  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: "APIFY_TOKEN is not configured on the scraper service." });
  }

  const limit = Number(reelsLimit) || DEFAULT_LIMIT;
  const results = [];
  const errors = [];

  for (const rawHandle of handles) {
    const handle = cleanHandle(rawHandle);
    try {
      const performance = await analyzePerformance(handle, limit, followerCounts);
      let audienceRaw = null;
      let audienceError = null;
      try {
        audienceRaw = await fetchAudienceForUsername(handle, {
          token: APIFY_TOKEN,
          actorId: HYPEBRIDGE_ACTOR_ID,
        });
      } catch (err) {
        audienceError = err.message;
      }

      const normalized = normalizeFullIntelligence({
        username: handle,
        performance,
        audienceRaw: audienceRaw || {},
      });
      normalized.errors = audienceError ? { audience: audienceError } : {};
      normalized.scores = calculateMountLiftScore(normalized);
      normalized.raw = { performance, audience: audienceRaw };
      results.push(normalized);
    } catch (err) {
      errors.push({ handle, error: err.message });
    }
  }

  if (results.length === 0) {
    return res.status(502).json({ error: "All handles failed.", errors });
  }

  const workbook = await buildWorkbook(results);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="mountlift-insights-${Date.now()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`IG Engagement Analyzer backend running on http://localhost:${PORT}`);
});
