import axios from "axios";

const APIFY_BASE = "https://api.apify.com/v2";

/**
 * Runs the apify/instagram-reel-scraper actor for a single username and
 * returns the raw dataset items (one item per reel).
 *
 * Real fields returned by this actor (confirmed from Apify's docs, Aug 2026):
 *   ownerUsername, ownerFullName, ownerId, shortCode, url,
 *   likesCount, commentsCount, videoViewCount, videoPlayCount,
 *   timestamp, caption, hashtags, mentions, videoDuration,
 *   isCommentsDisabled, paidPartnership, productType
 *
 * Quirk: likesCount can be -1 when Instagram has hidden the like count
 * for that post. We handle that downstream in metrics.js.
 */
export async function fetchReelsForUsername(username, { limit = 12, token, actorId } = {}) {
  if (!token) {
    throw new Error("Missing Apify API token");
  }

  const cleanUsername = username.trim().replace(/^@/, "");

  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`;

  const input = {
    username: [cleanUsername],
    resultsLimit: limit,
  };

  try {
    const { data } = await axios.post(url, input, {
      params: { token },
      headers: { "Content-Type": "application/json" },
      timeout: 120_000,
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
