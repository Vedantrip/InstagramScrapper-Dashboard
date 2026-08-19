import ExcelJS from "exceljs";

/**
 * Builds an .xlsx workbook from an array of metrics objects
 * (as produced by computeMetricsForUsername), one per handle.
 * Returns the ExcelJS Workbook — caller decides how to ship it
 * (save to disk, stream as HTTP response, etc.)
 */
export async function buildWorkbook(resultsArray) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IG Engagement Analyzer";
  workbook.created = new Date();

  // ---- Summary sheet ----
  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Username", key: "username", width: 20 },
    { header: "Reels Analyzed", key: "reelsAnalyzed", width: 15 },
    { header: "Avg Views", key: "avgViews", width: 14 },
    { header: "Median Views", key: "medianViews", width: 14 },
    { header: "Avg Likes", key: "avgLikes", width: 12 },
    { header: "Avg Comments", key: "avgComments", width: 14 },
    { header: "Avg Engagement Rate %", key: "avgEngagementRatePct", width: 20 },
    { header: "Consistency (CoV)", key: "cov", width: 16 },
    { header: "Consistency Label", key: "consistencyLabel", width: 20 },
    { header: "Avg Days Between Posts", key: "avgDaysBetweenPosts", width: 20 },
    { header: "Follower Count", key: "followerCount", width: 15 },
    { header: "Views/Follower %", key: "viewToFollowerRatioPct", width: 16 },
    { header: "Hidden-Like Reels", key: "hiddenLikesCount", width: 16 },
  ];
  summary.getRow(1).font = { bold: true };

  for (const r of resultsArray) {
    summary.addRow({
      username: r.username,
      reelsAnalyzed: r.reelsAnalyzed,
      avgViews: r.avgViews,
      medianViews: r.medianViews,
      avgLikes: r.avgLikes,
      avgComments: r.avgComments,
      avgEngagementRatePct: r.avgEngagementRatePct,
      cov: r.consistency?.coefficientOfVariation,
      consistencyLabel: r.consistency?.label,
      avgDaysBetweenPosts: r.avgDaysBetweenPosts,
      followerCount: r.followerCount,
      viewToFollowerRatioPct: r.viewToFollowerRatioPct,
      hiddenLikesCount: r.hiddenLikesCount,
    });
  }

  // ---- Reel-by-reel detail sheet ----
  const detail = workbook.addWorksheet("Reel Detail");
  detail.columns = [
    { header: "Username", key: "username", width: 20 },
    { header: "Shortcode", key: "shortCode", width: 16 },
    { header: "URL", key: "url", width: 40 },
    { header: "Timestamp", key: "timestamp", width: 22 },
    { header: "Views", key: "views", width: 12 },
    { header: "Likes", key: "likes", width: 10 },
    { header: "Likes Hidden?", key: "likesHidden", width: 14 },
    { header: "Comments", key: "comments", width: 12 },
    { header: "Engagement", key: "engagement", width: 12 },
    { header: "Engagement Rate %", key: "engagementRatePct", width: 18 },
    { header: "Caption (preview)", key: "caption", width: 40 },
  ];
  detail.getRow(1).font = { bold: true };

  for (const r of resultsArray) {
    for (const reel of r.perReel) {
      detail.addRow({
        username: r.username,
        shortCode: reel.shortCode,
        url: reel.url,
        timestamp: reel.timestamp,
        views: reel.views,
        likes: reel.likesHidden ? "hidden" : reel.likes,
        likesHidden: reel.likesHidden ? "Yes" : "No",
        comments: reel.comments,
        engagement: reel.engagement,
        engagementRatePct: reel.engagementRate !== null ? round(reel.engagementRate * 100, 2) : null,
        caption: reel.caption,
      });
    }
  }

  return workbook;
}

function round(n, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
