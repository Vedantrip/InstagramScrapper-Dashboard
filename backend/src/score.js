function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value);
}

function scoreEngagement(performance = {}) {
  const rate = Number(performance.engagementRate);
  if (!Number.isFinite(rate)) return 50;
  // 8%+ average reel engagement is treated as an excellent public-performance signal.
  return clamp((rate / 8) * 100);
}

function scoreAudience(audience = {}) {
  const confidence = String(audience.confidence || "medium").toLowerCase();
  const populatedSignals = [audience.gender, audience.age, audience.locations, audience.interests]
    .filter((items) => Array.isArray(items) && items.length > 0).length;
  const confidenceBase = confidence === "high" ? 88 : confidence === "low" ? 52 : 70;
  return clamp(confidenceBase + populatedSignals * 3);
}

function scoreContent(performance = {}) {
  const avgViews = Number(performance.avgViews);
  const ratio = Number(performance.viewToFollowerRatio);
  if (Number.isFinite(ratio) && ratio > 0) {
    return clamp((ratio / 0.75) * 100);
  }
  if (Number.isFinite(avgViews) && avgViews > 0) {
    return clamp(55 + Math.log10(avgViews + 1) * 5);
  }
  return 50;
}

function scoreConsistency(performance = {}) {
  const label = String(performance.consistency || "").toLowerCase();
  if (label.includes("very consistent")) return 95;
  if (label === "consistent") return 88;
  if (label.includes("somewhat")) return 68;
  if (label.includes("highly inconsistent")) return 35;
  return 60;
}

function scoreProfile(profile = {}) {
  let score = 50;
  if (profile.profileUrl) score += 15;
  if (profile.verified) score += 20;
  if (Number(profile.followers) > 0) score += 10;
  if (Number(profile.posts) > 0) score += 5;
  return clamp(score);
}

export function calculateMountLiftScore({ profile, performance, audience }) {
  const engagement = scoreEngagement(performance);
  const audienceScore = scoreAudience(audience);
  const content = scoreContent(performance);
  const consistency = scoreConsistency(performance);
  const profileQuality = scoreProfile(profile);

  const overall = round(
    engagement * 0.30 +
    audienceScore * 0.25 +
    content * 0.20 +
    consistency * 0.15 +
    profileQuality * 0.10
  );

  return {
    engagement: round(engagement),
    audience: round(audienceScore),
    content: round(content),
    consistency: round(consistency),
    profile: round(profileQuality),
    overall: clamp(overall),
    methodology: "MountLift proprietary v1",
    weights: {
      engagement: 0.30,
      audience: 0.25,
      content: 0.20,
      consistency: 0.15,
      profile: 0.10,
    },
  };
}
