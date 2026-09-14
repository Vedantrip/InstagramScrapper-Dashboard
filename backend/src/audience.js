import axios from "axios";

const APIFY_BASE = "https://api.apify.com/v2";
const DEFAULT_ACTOR_ID = "hypebridge~influencer-evaluation-agent-instagram-tiktok";

/**
 * Runs the HypeBridge public-data evaluator for one Instagram handle.
 * This is estimated audience intelligence, not official Instagram Insights.
 * The complete raw actor response is returned so downstream normalizers can
 * evolve without throwing information away.
 */
export async function fetchAudienceForUsername(
  username,
  { token, actorId = DEFAULT_ACTOR_ID, timeout = 280_000 } = {}
) {
  if (!token) throw new Error("Missing Apify API token");

  const cleanUsername = String(username || "").trim().replace(/^@/, "");
  if (!cleanUsername) throw new Error("Username is required");

  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items`;
  const input = {
    influencerHandle: cleanUsername,
    platform: "instagram",
  };

  try {
    const { data } = await axios.post(url, input, {
      params: { token },
      headers: { "Content-Type": "application/json" },
      timeout,
    });

    return Array.isArray(data) ? data : [data];
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const message =
        err.response.data?.error?.message ||
        err.response.data?.message ||
        err.response.statusText ||
        "Unknown HypeBridge error";
      throw new Error(`HypeBridge request failed (${status}): ${message}`);
    }
    throw err;
  }
}

export { DEFAULT_ACTOR_ID as HYPEBRIDGE_DEFAULT_ACTOR_ID };
