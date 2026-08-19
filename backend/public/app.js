const API_BASE = window.__ML_API_BASE__ || window.location.origin;

const form = document.getElementById("auditForm");
const handlesInput = document.getElementById("handlesInput");
const reelsLimitInput = document.getElementById("reelsLimit");
const runBtn = document.getElementById("runBtn");
const exportBtn = document.getElementById("exportBtn");
const configNote = document.getElementById("configNote");
const resultsGrid = document.getElementById("resultsGrid");
const resultsHeader = document.getElementById("resultsHeader");
const emptyState = document.getElementById("emptyState");
const apiStatus = document.getElementById("apiStatus");
const apiStatusLabel = document.getElementById("apiStatusLabel");

let lastRunPayload = null; // { handles, reelsLimit } — reused for export

init();

async function init() {
  await checkBackend();
  form.addEventListener("submit", handleRunAudit);
  exportBtn.addEventListener("click", handleExport);
}

async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (!res.ok) throw new Error();
    apiStatus.classList.add("online");
    apiStatusLabel.textContent = "backend online";
  } catch {
    apiStatus.classList.add("offline");
    apiStatusLabel.textContent = "backend unreachable";
    configNote.textContent = `Can't reach the API at ${API_BASE}. Start the backend (npm start in /backend) and refresh.`;
  }
}

function parseHandles(raw) {
  return raw
    .split(/[\n,]/)
    .map((h) => h.trim().replace(/^@/, ""))
    .filter(Boolean);
}

async function handleRunAudit(e) {
  e.preventDefault();
  configNote.textContent = "";

  const handles = parseHandles(handlesInput.value);
  const reelsLimit = Number(reelsLimitInput.value) || 12;

  if (handles.length === 0) {
    configNote.textContent = "Enter at least one handle.";
    return;
  }

  setLoading(true);
  emptyState.hidden = true;
  resultsHeader.hidden = false;
  resultsGrid.innerHTML = renderSkeletons(handles.length);

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handles, reelsLimit }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }

    const data = await res.json();
    renderResults(data.results || [], data.errors || []);
    configNote.textContent = "";

    lastRunPayload = { handles, reelsLimit };
    exportBtn.disabled = (data.results || []).length === 0;
  } catch (err) {
    resultsGrid.innerHTML = "";
    emptyState.hidden = false;
    emptyState.querySelector("p").textContent = `Audit failed: ${err.message}`;
    configNote.textContent = err.message;
  } finally {
    setLoading(false);
  }
}

async function handleExport() {
  if (!lastRunPayload) return;

  exportBtn.disabled = true;
  const originalLabel = exportBtn.textContent;
  exportBtn.textContent = "exporting…";

  try {
    const res = await fetch(`${API_BASE}/analyze/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastRunPayload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Export failed (${res.status})`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ig-engagement-report-${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    configNote.textContent = err.message;
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = originalLabel;
  }
}

let loadingTimer = null;

function setLoading(isLoading) {
  runBtn.disabled = isLoading;

  if (isLoading) {
    let elapsed = 0;
    runBtn.innerHTML = `<span class="btn-glyph">&gt;_</span> auditing&hellip;`;
    configNote.style.color = "var(--text-muted)";
    configNote.textContent = "Scraping live reels — first runs can take a couple of minutes, this isn't frozen.";
    loadingTimer = setInterval(() => {
      elapsed += 1;
      runBtn.innerHTML = `<span class="btn-glyph">&gt;_</span> auditing&hellip; ${elapsed}s`;
    }, 1000);
  } else {
    clearInterval(loadingTimer);
    configNote.style.color = "";
    runBtn.innerHTML = `<span class="btn-glyph">&gt;_</span> run audit`;
  }
}

function renderSkeletons(count) {
  return Array.from({ length: count })
    .map(
      () => `
    <div class="card" style="opacity:0.4">
      <div class="card-head">
        <span class="card-handle">scanning</span>
      </div>
      <div class="waveform">
        ${Array.from({ length: 10 })
          .map(() => `<div class="waveform-bar" style="height:${10 + Math.random() * 40}px"></div>`)
          .join("")}
      </div>
    </div>`
    )
    .join("");
}

function consistencyBadge(consistency) {
  const label = consistency?.label || "Unknown";
  const map = {
    "Very consistent": "badge-signal",
    Consistent: "badge-signal",
    "Somewhat inconsistent": "badge-mixed",
    "Highly inconsistent": "badge-noise",
    Unknown: "badge-mixed",
  };
  return { label, cls: map[label] || "badge-mixed" };
}

function renderResults(results, errors) {
  const cards = results.map(renderCard).join("");
  const errorCards = errors.map(renderErrorCard).join("");
  resultsGrid.innerHTML = cards + errorCards;

  if (results.length === 0 && errors.length === 0) {
    emptyState.hidden = false;
    emptyState.querySelector("p").textContent = "No data returned. Try a different handle.";
  } else {
    emptyState.hidden = true;
  }
}

function renderErrorCard({ handle, error }) {
  return `
    <div class="card">
      <div class="card-head">
        <span class="card-handle">${escapeHtml(handle)}</span>
        <span class="badge badge-noise">failed</span>
      </div>
      <p class="card-error">${escapeHtml(error)}</p>
    </div>`;
}

function renderCard(r) {
  const { label, cls } = consistencyBadge(r.consistency);
  const views = r.perReel.map((p) => ({ v: p.views || 0, hiddenLike: p.likesHidden, cap: p.caption }));
  const max = Math.max(1, ...views.map((v) => v.v));

  const bars = views
    .map((v) => {
      const h = Math.max(2, Math.round((v.v / max) * 56));
      const title = `${v.v.toLocaleString()} views${v.hiddenLike ? " · likes hidden" : ""}`;
      return `<div class="waveform-bar${v.hiddenLike ? " hidden-like" : ""}" style="height:${h}px" title="${escapeHtml(title)}"></div>`;
    })
    .join("");

  return `
    <div class="card">
      <div class="card-head">
        <div>
          <span class="card-handle">${escapeHtml(r.username)}</span>
          <div class="card-meta">${r.reelsAnalyzed} reels analyzed${r.hiddenLikesCount ? ` · ${r.hiddenLikesCount} hidden-like` : ""}</div>
        </div>
        <span class="badge ${cls}">${escapeHtml(label.toLowerCase())}</span>
      </div>

      <div class="stat-row">
        <div class="stat">
          <span class="stat-label">avg views</span>
          <span class="stat-value accent">${formatNum(r.avgViews)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">median views</span>
          <span class="stat-value">${formatNum(r.medianViews)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">engagement rate</span>
          <span class="stat-value">${r.avgEngagementRatePct ?? "—"}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">post cadence</span>
          <span class="stat-value">${r.avgDaysBetweenPosts ? `${r.avgDaysBetweenPosts}d` : "—"}</span>
        </div>
        ${
          r.viewToFollowerRatioPct !== null
            ? `<div class="stat">
                <span class="stat-label">views/follower</span>
                <span class="stat-value">${r.viewToFollowerRatioPct}%</span>
              </div>`
            : ""
        }
      </div>

      <div class="waveform-wrap">
        <div class="waveform-label">
          <span>view signal · last ${r.perReel.length} reels</span>
          <span>noise: ${r.consistency?.coefficientOfVariation ?? "—"}</span>
        </div>
        <div class="waveform">${bars}</div>
      </div>
    </div>`;
}

function formatNum(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
