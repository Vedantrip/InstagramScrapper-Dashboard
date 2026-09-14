function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/%/g, "").trim();
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function normalizeDistribution(value) {
  return asArray(value).map((item) => {
    if (typeof item === "string") return { label: item, value: null };
    if (!item || typeof item !== "object") return { label: String(item), value: null };

    const label = firstDefined(
      item.label,
      item.name,
      item.category,
      item.location,
      item.country,
      item.city,
      item.gender,
      item.age,
      item.range
    );
    const numericValue = firstDefined(
      item.value,
      item.percentage,
      item.percent,
      item.share,
      item.weight,
      item.count
    );

    return {
      label: label == null ? "Unknown" : String(label),
      value: asNumber(numericValue),
    };
  });
}

function findDeep(root, keys, depth = 0) {
  if (!root || typeof root !== "object" || depth > 6) return undefined;
  if (Array.isArray(root)) {
    for (const item of root) {
      const result = findDeep(item, keys, depth + 1);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  for (const [key, value] of Object.entries(root)) {
    if (keys.has(String(key).toLowerCase()) && value !== undefined && value !== null) {
      return value;
    }
  }

  for (const value of Object.values(root)) {
    const result = findDeep(value, keys, depth + 1);
    if (result !== undefined) return result;
  }
  return undefined;
}

function pickDistribution(raw, aliases) {
  const value = findDeep(raw, new Set(aliases.map((key) => key.toLowerCase())));
  return normalizeDistribution(value);
}

function normalizeAudience(rawResponse) {
  const raw = Array.isArray(rawResponse) && rawResponse.length === 1 ? rawResponse[0] : rawResponse;
  const source = raw && typeof raw === "object" ? raw : {};

  const gender = pickDistribution(source, [
    "gender",
    "genderdistribution",
    "gender_distribution",
    "audiencegender",
  ]);
  const age = pickDistribution(source, [
    "age",
    "agedistribution",
    "age_distribution",
    "audienceage",
  ]);
  const locations = pickDistribution(source, [
    "locations",
    "location",
    "toplocations",
    "top_locations",
    "geography",
    "countries",
    "cities",
  ]);
  const interests = pickDistribution(source, [
    "interests",
    "interest",
    "audienceinterests",
    "audience_interests",
  ]);

  const confidence = firstDefined(
    findDeep(source, new Set(["confidence", "confidencelevel", "confidence_level"])),
    "medium"
  );

  const sourceVersion = firstDefined(
    findDeep(source, new Set(["version", "sourceversion", "modelversion"])),
    null
  );

  const profile = {
    followers: asNumber(findDeep(source, new Set(["followers", "followercount", "followerscount"]))),
    following: asNumber(findDeep(source, new Set(["following", "followingcount"]))),
    posts: asNumber(findDeep(source, new Set(["posts", "postcount", "media_count"]))),
    verified: Boolean(findDeep(source, new Set(["verified", "isverified"])) ?? false),
    profileUrl: firstDefined(
      findDeep(source, new Set(["profileurl", "profile_url", "instagramurl", "url"])),
      null
    ),
  };

  return {
    source: "estimated",
    label: "Audience Intelligence · Estimated from public signals",
    confidence: String(confidence).toLowerCase(),
    gender,
    age,
    locations,
    interests,
    profile,
    sourceVersion,
    raw: rawResponse,
  };
}

export function normalizeFullIntelligence({ username, performance, audienceRaw }) {
  const audience = normalizeAudience(audienceRaw);
  const profile = audience.profile;

  if (!profile.followers && performance?.followerCount) {
    profile.followers = performance.followerCount;
  }

  return {
    username,
    profile,
    performance: {
      avgViews: performance?.avgViews ?? null,
      medianViews: performance?.medianViews ?? null,
      avgLikes: performance?.avgLikes ?? null,
      avgComments: performance?.avgComments ?? null,
      engagementRate: performance?.avgEngagementRatePct ?? null,
      postingFrequencyDays: performance?.avgDaysBetweenPosts ?? null,
      viewToFollowerRatio: performance?.viewToFollowerRatioPct != null
        ? performance.viewToFollowerRatioPct / 100
        : null,
      consistency: performance?.consistency?.label ?? null,
      reelsAnalyzed: performance?.reelsAnalyzed ?? 0,
    },
    audience: {
      source: audience.source,
      label: audience.label,
      confidence: audience.confidence,
      gender: audience.gender,
      age: audience.age,
      locations: audience.locations,
      interests: audience.interests,
      sourceVersion: audience.sourceVersion,
    },
    rawAudience: audience.raw,
  };
}
