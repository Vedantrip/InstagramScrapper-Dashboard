/**
 * Turns raw Apify reel items into the metrics MountLift actually cares about.
 */

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// Best-effort view count: prefer videoPlayCount, fall back to videoViewCount
function getViews(reel) {
  const play = typeof reel.videoPlayCount === "number" ? reel.videoPlayCount : null;
  const view = typeof reel.videoViewCount === "number" ? reel.videoViewCount : null;
  if (play !== null && play >= 0) return play;
  if (view !== null && view >= 0) return view;
  return null; // truly unavailable
}

function consistencyLabel(cv) {
  // cv = coefficient of variation (stdDev / mean). Lower = more consistent.
  if (cv === null) return "Unknown";
  if (cv < 0.4) return "Very consistent";
  if (cv < 0.7) return "Consistent";
  if (cv < 1.1) return "Somewhat inconsistent";
  return "Highly inconsistent";
}

export function computeMetricsForUsername(username, rawReels, { followerCount = null } = {}) {
  const reels = Array.isArray(rawReels) ? rawReels : [];

  const perReel = reels.map((r) => {
    const views = getViews(r);
    const likes = typeof r.likesCount === "number" && r.likesCount >= 0 ? r.likesCount : null; // -1 = hidden by IG
    const comments = typeof r.commentsCount === "number" ? r.commentsCount : 0;
    const engagement = likes !== null ? likes + comments : null;
    const engagementRate = engagement !== null && views ? engagement / views : null;

    return {
      shortCode: r.shortCode || null,
      url: r.url || r.inputUrl || null,
      caption: (r.caption || "").slice(0, 80),
      timestamp: r.timestamp || null,
      views,
      likes,
      comments,
      likesHidden: r.likesCount === -1,
      engagement,
      engagementRate,
    };
  });

  const validViews = perReel.map((r) => r.views).filter((v) => v !== null);
  const validLikes = perReel.map((r) => r.likes).filter((v) => v !== null);
  const validEngagementRates = perReel.map((r) => r.engagementRate).filter((v) => v !== null);

  const avgViews = mean(validViews);
  const medianViews = median(validViews);
  const avgLikes = mean(validLikes);
  const avgComments = mean(perReel.map((r) => r.comments));
  const avgEngagementRate = mean(validEngagementRates); // (likes+comments)/views, averaged per reel

  const sd = stdDev(validViews);
  const coefficientOfVariation = avgViews > 0 ? sd / avgViews : null;

  // Posting frequency: avg days between consecutive reels (sorted by time)
  const timestamps = perReel
    .map((r) => (r.timestamp ? new Date(r.timestamp).getTime() : null))
    .filter((t) => t !== null)
    .sort((a, b) => a - b);

  let avgDaysBetweenPosts = null;
  if (timestamps.length >= 2) {
    const gaps = [];
    for (let i = 1; i < timestamps.length; i++) {
      gaps.push((timestamps[i] - timestamps[i - 1]) / (1000 * 60 * 60 * 24));
    }
    avgDaysBetweenPosts = mean(gaps);
  }

  const viewToFollowerRatio =
    followerCount && followerCount > 0 && avgViews > 0 ? avgViews / followerCount : null;

  return {
    username,
    reelsAnalyzed: perReel.length,
    reelsWithViewData: validViews.length,
    avgViews: round(avgViews),
    medianViews: round(medianViews),
    avgLikes: round(avgLikes),
    avgComments: round(avgComments),
    avgEngagementRatePct: avgEngagementRate !== null ? round(avgEngagementRate * 100, 2) : null,
    consistency: {
      stdDevViews: round(sd),
      coefficientOfVariation: coefficientOfVariation !== null ? round(coefficientOfVariation, 2) : null,
      label: consistencyLabel(coefficientOfVariation),
    },
    avgDaysBetweenPosts: avgDaysBetweenPosts !== null ? round(avgDaysBetweenPosts, 1) : null,
    followerCount: followerCount || null,
    viewToFollowerRatioPct: viewToFollowerRatio !== null ? round(viewToFollowerRatio * 100, 2) : null,
    hiddenLikesCount: perReel.filter((r) => r.likesHidden).length,
    perReel,
  };
}

function round(n, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
