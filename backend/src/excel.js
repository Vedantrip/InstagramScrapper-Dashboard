import ExcelJS from "exceljs";

/**
 * Builds an .xlsx workbook from an array of performance or full-intelligence
 * results. Existing performance columns are preserved for compatibility.
 */
export async function buildWorkbook(resultsArray) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MountLift Insights";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Username", key: "username", width: 20 },
    { header: "Followers", key: "followers", width: 14 },
    { header: "Following", key: "following", width: 14 },
    { header: "Posts", key: "posts", width: 12 },
    { header: "Verified", key: "verified", width: 12 },
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
    { header: "MountLift Score", key: "overallScore", width: 16 },
    { header: "Engagement Score", key: "engagementScore", width: 18 },
    { header: "Audience Score", key: "audienceScore", width: 16 },
    { header: "Content Score", key: "contentScore", width: 16 },
    { header: "Consistency Score", key: "consistencyScore", width: 18 },
    { header: "Audience Source", key: "audienceSource", width: 18 },
    { header: "Audience Confidence", key: "audienceConfidence", width: 20 },
    { header: "Hidden-Like Reels", key: "hiddenLikesCount", width: 16 },
  ];
  summary.getRow(1).font = { bold: true };

  for (const r of resultsArray) {
    const performance = r.performance || r;
    const profile = r.profile || {};
    const scores = r.scores || {};
    const audience = r.audience || {};

    summary.addRow({
      username: r.username,
      followers: profile.followers ?? performance.followerCount ?? null,
      following: profile.following,
      posts: profile.posts,
      verified: profile.verified ?? null,
      reelsAnalyzed: performance.reelsAnalyzed,
      avgViews: performance.avgViews,
      medianViews: performance.medianViews,
      avgLikes: performance.avgLikes,
      avgComments: performance.avgComments,
      avgEngagementRatePct: performance.avgEngagementRatePct ?? performance.engagementRate,
      cov: performance.consistency?.coefficientOfVariation,
      consistencyLabel: performance.consistency?.label ?? performance.consistency,
      avgDaysBetweenPosts: performance.avgDaysBetweenPosts ?? performance.postingFrequencyDays,
      followerCount: performance.followerCount,
      viewToFollowerRatioPct: performance.viewToFollowerRatioPct != null
        ? performance.viewToFollowerRatioPct
        : typeof performance.viewToFollowerRatio === "number"
          ? performance.viewToFollowerRatio * 100
          : null,
      overallScore: scores.overall,
      engagementScore: scores.engagement,
      audienceScore: scores.audience,
      contentScore: scores.content,
      consistencyScore: scores.consistency,
      audienceSource: audience.source,
      audienceConfidence: audience.confidence,
      hiddenLikesCount: performance.hiddenLikesCount,
    });
  }

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
    const reels = r.performance?.perReel || r.perReel || [];
    for (const reel of reels) {
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
