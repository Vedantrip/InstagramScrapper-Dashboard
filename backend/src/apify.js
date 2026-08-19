import axios from "axios";

const APIFY_BASE = "https://api.apify.com/v2";

/**
 * Runs an Apify Instagram actor for a single username and returns the raw
 * dataset items (one item per reel).
 *
 * Supports two actor shapes, since we've built against both:
 *
 *  - "apify/instagram-reel-scraper" (dedicated reel actor)
 *      input: { username: [handle], resultsLimit }
 *
 *  - "apify/instagram-scraper" (Apify's general-purpose actor)
 *      input: { directUrls: [profileUrl], resultsType: "reels", resultsLimit }
 *
 * Both return the same underlying media object shape (confirmed from
 * Apify's docs, Aug 2026): ownerUsername, ownerFullName, ownerId,
 * shortCode, url, likesCount, commentsCount, videoViewCount,
 * videoPlayCount, timestamp, caption, hashtags, mentions, videoDuration,
 * isCommentsDisabled, paidPartnership, productType ("clips" for reels).
 *
 * Quirk: likesCount can be -1 when Instagram has hidden the like count
 * for that post. We handle that downstream in metrics.js.
 */
export async function fetchReelsForUsername(
  username,
  { limit = 12, token, actorId = "apify~instagram-scraper" } = {}
) {
  if (!token) {
    throw new Error("Missing Apify API token");
  }

  const cleanUsername = username.trim().replace(/^@/, "");
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`;

  const input = actorId.includes("instagram-reel-scraper")
    ? { username: [cleanUsername], resultsLimit: limit }
    : {
        directUrls: [`https://www.instagram.com/${cleanUsername}/`],
        resultsType: "reels",
        resultsLimit: limit,
      };

  try {
    const { data } = await axios.post(url, input, {
      params: { token },
      headers: { "Content-Type": "application/json" },
      // General-purpose scraper actors spin up a real browser and can take
      // several minutes on a cold start, especially on the free plan.
      timeout: 280_000,
    });

    if (!Array.isArray(data)) {
      throw new Error("Unexpected response shape from Apify actor");
    }

    return data;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const message =
        err.response.data?.error?.message || err.response.statusText || "Unknown Apify error";
      throw new Error(`Apify request failed (${status}): ${message}`);
    }
    throw err;
  }
}
