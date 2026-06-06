import { useState, useEffect, useCallback } from "react";
import "./AdminDashboard.css";

const API_BASE_URL = process.env.REACT_APP_BASEURL;

/* =========================================================
   HELPERS
========================================================= */

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString();
}

function initials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const AVATAR_COLORS = [
  "#3a1fff",
  "#0f6e56",
  "#712b13",
  "#3c3489",
  "#633806",
  "#185fa5",
];

function avatarColor(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* =========================================================
   SUB-COMPONENTS
========================================================= */

function StatCard({ label, value, sub, deltaUp, deltaDown }) {
  return (
    <div className="statCard">
      <span className="statLabel">{label}</span>
      <span className="statValue">{value}</span>
      {sub && <span className="statSub">{sub}</span>}
      {deltaUp && <span className="statDelta up">↑ {deltaUp}</span>}
      {deltaDown && <span className="statDelta down">↓ {deltaDown}</span>}
    </div>
  );
}

function StatusDot({ status }) {
  const cls =
    status === "active" ? "dotGreen"
    : status === "idle" ? "dotAmber"
    : "dotRed";
  return <span className={`dot ${cls}`} />;
}

function TierBadge({ tier }) {
  const cls =
    tier === "premium" ? "badgePremium"
    : tier === "enterprise" ? "badgeEnterprise"
    : "badgeFree";
  return <span className={`badge ${cls}`}>{tier}</span>;
}

function SubBadge({ status }) {
  const cls =
    status === "active" ? "badgePremium"
    : status === "expired" ? "badgeExpired"
    : status === "cancelled" ? "badgeExpired"
    : "badgeFree";
  return <span className={`badge ${cls}`}>{status}</span>;
}

function QueueBar({ label, value, max, colorClass }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="queueRow">
      <span className="queueLabel">{label}</span>
      <div className="queueBarTrack">
        <div className={`queueBarFill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="queueVal">{value}</span>
    </div>
  );
}

function ModelBar({ model, count, pct, color }) {
  return (
    <div className="modelRow">
      <span className="modelDot" style={{ background: color }} />
      <span className="modelName">{model}</span>
      <div className="modelTrack">
        <div className="modelFill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="modelPct">{pct}%</span>
      <span className="modelCount">{fmt(count)}/day</span>
    </div>
  );
}

const MODEL_COLORS = {
  "gemini-2.5-flash": "#378ADD",
  "gemini-2.5-pro": "#1D9E75",
  "gemini-embedding-001": "#888780",
};

function getModelColor(name = "") {
  return MODEL_COLORS[name] || "#5a4bff";
}

/* =========================================================
   MINI CHART — pure CSS bars
========================================================= */

function HourlyChart({ hourly = [] }) {
  if (!hourly.length) return <div className="chartEmpty">No data</div>;
  const max = Math.max(...hourly.map((h) => h.count), 1);
  const show = hourly.filter((_, i) => i % 2 === 0); // every other hour to fit
  return (
    <div className="hourlyChart" aria-label="Hourly query volume chart">
      {show.map(({ hour, count }) => (
        <div key={hour} className="hourlyCol">
          <div
            className="hourlyBar"
            style={{ height: `${Math.max(4, Math.round((count / max) * 100))}%` }}
            title={`${hour}: ${count} queries`}
          />
          <span className="hourlyLabel">{hour.slice(0, 2)}</span>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   LOG ROW
========================================================= */

function LogRow({ time, level, msg }) {
  const levelCls =
    level === "ok" ? "logOk"
    : level === "warn" ? "logWarn"
    : "logErr";
  const levelText = level === "ok" ? "✓ ok" : level === "warn" ? "⚠ warn" : "✗ err";
  return (
    <div className="logRow">
      <span className="logTime">{time}</span>
      <span className={`logBadge ${levelCls}`}>{levelText}</span>
      <span className="logMsg" dangerouslySetInnerHTML={{ __html: msg }} />
    </div>
  );
}

/* =========================================================
   USERS TABLE
========================================================= */

function UsersTable({ users = [], loading }) {
  if (loading) return <div className="tableEmpty">Loading users…</div>;
  if (!users.length) return <div className="tableEmpty">No users found.</div>;

  return (
    <div className="tableWrap">
      <table className="usersTable">
        <thead>
          <tr>
            <th>User</th>
            <th>Tier</th>
            <th>Sub status</th>
            <th>Requests</th>
            <th>Last active</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const bg = avatarColor(u.name || u.email);
            const isActive =
              Date.now() - new Date(u.lastActiveAt).getTime() < 5 * 60 * 1000;
            const isIdle =
              !isActive &&
              Date.now() - new Date(u.lastActiveAt).getTime() < 60 * 60 * 1000;
            const status = isActive ? "active" : isIdle ? "idle" : "inactive";

            return (
              <tr key={u.id}>
                <td>
                  <div className="userCell">
                    <span className="avatar" style={{ background: bg }}>
                      {initials(u.name)}
                    </span>
                    <div>
                      <span className="userName">{u.name}</span>
                      <span className="userEmail">{u.email}</span>
                    </div>
                  </div>
                </td>
                <td><TierBadge tier={u.tier} /></td>
                <td><SubBadge status={u.subscriptionStatus} /></td>
                <td className="numCell">{fmt(u.dailyRequestCount)}</td>
                <td className="mutedCell">{timeAgo(u.lastActiveAt)}</td>
                <td><StatusDot status={status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tierFilter, setTierFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (bust = false) => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      if (tierFilter !== "all") params.set("tier", tierFilter);
      if (bust) params.set("refresh", "true");

      const res = await fetch(
        `${API_BASE_URL}/admin/stats?${params.toString()}`,
        { credentials: "include" }
      );

      if (res.status === 401) throw new Error("Unauthorized — please log in");
      if (res.status === 403) throw new Error("Forbidden — admin access only");
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tierFilter]);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => fetchStats(), 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Live queue polling every 10s (separate, uncached endpoint)
  useEffect(() => {
    const pollQueue = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/queue`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const json = await res.json();
        setData((prev) =>
          prev ? { ...prev, queue: json.queue, recentFailures: json.recentFailures } : prev
        );
      } catch {
        // silent — queue polling is best-effort
      }
    };
    const interval = setInterval(pollQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------------------------------------
     DERIVED DATA
  ------------------------------------------------------- */

  const u = data?.users || {};
  const q = data?.queue || {};
  const v = data?.queryVolume || {};
  const l = data?.latency || {};
  const m = data?.modelUsage || {};
  const h = data?.health || {};
  const recentUsers = data?.recentUsers || [];
  const failures = data?.queue?.recentFailures || [];

  const queueMax = Math.max(q.waiting || 0, 20);

  const mockLogs = [
    { time: new Date().toLocaleTimeString(), level: "ok", msg: "<strong>RAG</strong> completed — latency 1.2s, gemini-2.5-flash, 4 sources" },
    { time: new Date(Date.now() - 18000).toLocaleTimeString(), level: "ok", msg: "<strong>WORKER</strong> ingestion job completed successfully" },
    { time: new Date(Date.now() - 44000).toLocaleTimeString(), level: "warn", msg: "<strong>CLAUSE_CHECKER</strong> non-fatal timeout after 5000ms" },
    { time: new Date(Date.now() - 90000).toLocaleTimeString(), level: "ok", msg: "<strong>AUTH</strong> Google OAuth login — user joined" },
    { time: new Date(Date.now() - 140000).toLocaleTimeString(), level: "ok", msg: "<strong>RAG</strong> cache HIT — served in 43ms from Redis" },
    ...failures.map((f) => ({
      time: f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : "—",
      level: "err",
      msg: `<strong>QUEUE</strong> job #${f.id} failed after ${f.attemptsMade} attempts — ${f.failedReason || "unknown"}`,
    })),
  ];

  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  if (loading) {
    return (
      <div className="dashPage">
        <div className="loadingState">
          <div className="spinner" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashPage">
        <div className="errorState">
          <h2>⚠ {error}</h2>
          <button className="refreshBtn" onClick={() => fetchStats(true)}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashPage">
      <div className="dashContainer">

        {/* ── TOP BAR ── */}
        <div className="topBar">
          <div className="topBarLeft">
            <h1 className="dashTitle">Legal RAG — Admin</h1>
            <div className="topBarMeta">
              <span className={`healthPill ${h.mongodb === "connected" ? "pillGreen" : "pillRed"}`}>
                <span className="dot dotGreen" /> {h.mongodb === "connected" ? "All systems operational" : "Degraded"}
              </span>
              <span className="uptime">Uptime {Math.floor((h.uptime || 0) / 3600)}h</span>
              {lastRefresh && (
                <span className="lastRefresh">
                  Updated {timeAgo(lastRefresh)}
                </span>
              )}
            </div>
          </div>
          <button
            className={`refreshBtn ${refreshing ? "spinning" : ""}`}
            onClick={() => fetchStats(true)}
            disabled={refreshing}
          >
            ↻ Refresh
          </button>
        </div>

        {/* ── HEALTH STRIP ── */}
        <div className="healthStrip">
          {[
            { label: "MongoDB", val: h.mongodb },
            { label: "Qdrant", val: h.qdrant },
            { label: "Redis", val: h.redis },
          ].map(({ label, val }) => (
            <div key={label} className="healthChip">
              <span className={`dot ${val === "connected" ? "dotGreen" : "dotRed"}`} />
              <span className="healthLabel">{label}</span>
              <span className={`healthVal ${val === "connected" ? "textGreen" : "textRed"}`}>{val || "—"}</span>
            </div>
          ))}
          <div className="healthChip">
            <span className={`dot ${q.overloaded ? "dotRed" : "dotGreen"}`} />
            <span className="healthLabel">Queue</span>
            <span className={`healthVal ${q.overloaded ? "textRed" : "textGreen"}`}>
              {q.status || "—"}
            </span>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="statGrid">
          <StatCard
            label="Total users"
            value={fmt(u.total)}
            deltaUp={u.newThisWeek ? `${fmt(u.newThisWeek)} this week` : null}
          />
          <StatCard
            label="Premium users"
            value={fmt(u.premium)}
            sub={`${u.premiumPct ?? 0}% of total`}
          />
          <StatCard
            label="Queries today"
            value={fmt(v.todayTotal)}
            deltaUp={v.deltaPercent > 0 ? `${v.deltaPercent}% vs yesterday` : null}
            deltaDown={v.deltaPercent < 0 ? `${Math.abs(v.deltaPercent)}% vs yesterday` : null}
          />
          <StatCard
            label="Avg latency"
            value={l.avg ? `${(l.avg / 1000).toFixed(1)}s` : "—"}
            sub={l.p95 ? `p95 ${(l.p95 / 1000).toFixed(1)}s · p99 ${(l.p99 / 1000).toFixed(1)}s` : null}
          />
        </div>

        {/* ── CHART + QUEUE ── */}
        <div className="midGrid">
          <div className="dashCard chartCard">
            <div className="cardHeader">
              <span className="cardTitle">Query volume (24h)</span>
              <span className="pillGreen smallPill"><span className="dot dotGreen" /> Live</span>
            </div>
            <HourlyChart hourly={v.hourly} />
          </div>

          <div className="dashCard">
            <div className="cardHeader">
              <span className="cardTitle">Queue status</span>
              <span className={`smallPill ${q.overloaded ? "pillRed" : "pillGreen"}`}>
                <span className={`dot ${q.overloaded ? "dotRed" : "dotGreen"}`} />
                {q.status || "—"}
              </span>
            </div>
            <QueueBar label="Waiting" value={q.waiting || 0} max={queueMax} colorClass="barBlue" />
            <QueueBar label="Active" value={q.active || 0} max={queueMax} colorClass="barGreen" />
            <QueueBar label="Delayed" value={q.delayed || 0} max={queueMax} colorClass="barAmber" />
            <QueueBar label="Failed (24h)" value={q.failed || 0} max={queueMax} colorClass="barRed" />
            <div className="queueFooter">
              <span className="mutedCell">{fmt(q.completed)} completed total</span>
            </div>
          </div>
        </div>

        {/* ── USERS TABLE + MODEL USAGE ── */}
        <div className="bottomGrid">
          <div className="dashCard usersCard">
            <div className="cardHeader">
              <span className="cardTitle">Recent users</span>
              <div className="tabBar">
                {["all", "premium", "free"].map((t) => (
                  <button
                    key={t}
                    className={`tab ${tierFilter === t ? "tabActive" : ""}`}
                    onClick={() => setTierFilter(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <UsersTable users={recentUsers} loading={refreshing && !data} />
          </div>

          <div className="sideStack">
            <div className="dashCard">
              <div className="cardHeader">
                <span className="cardTitle">Model usage</span>
                <span className="mutedCell">{fmt(m.total)} total</span>
              </div>
              {(m.breakdown || []).map((item) => (
                <ModelBar
                  key={item.model}
                  model={item.model}
                  count={item.count}
                  pct={item.pct}
                  color={getModelColor(item.model)}
                />
              ))}

              <div className="divider" />

              <div className="cardTitle" style={{ marginBottom: "1.2rem" }}>Tier split</div>
              <div className="tierRow">
                <span>Free</span>
                <div className="tierTrack">
                  <div
                    className="tierFill"
                    style={{
                      width: `${u.total ? Math.round((u.free / u.total) * 100) : 0}%`,
                      background: "#378ADD",
                    }}
                  />
                </div>
                <span className="mutedCell">{fmt(u.free)}</span>
              </div>
              <div className="tierRow">
                <span>Premium</span>
                <div className="tierTrack">
                  <div
                    className="tierFill"
                    style={{
                      width: `${u.total ? Math.round((u.premium / u.total) * 100) : 0}%`,
                      background: "#1D9E75",
                    }}
                  />
                </div>
                <span className="mutedCell">{fmt(u.premium)}</span>
              </div>
              {u.enterprise > 0 && (
                <div className="tierRow">
                  <span>Enterprise</span>
                  <div className="tierTrack">
                    <div
                      className="tierFill"
                      style={{
                        width: `${u.total ? Math.round((u.enterprise / u.total) * 100) : 0}%`,
                        background: "#7F77DD",
                      }}
                    />
                  </div>
                  <span className="mutedCell">{fmt(u.enterprise)}</span>
                </div>
              )}
            </div>

            <div className="dashCard violationCard">
              <div className="cardHeader">
                <span className="cardTitle">Violations</span>
                <span className="badge badgeExpired">{fmt(data?.violations?.total || 0)} total</span>
              </div>
              {(data?.violations?.recent || []).length === 0 ? (
                <p className="mutedCell">No recent violations.</p>
              ) : (
                data.violations.recent.map((v, i) => (
                  <div key={i} className="violationRow">
                    <span className="mutedCell">{timeAgo(v.createdAt)}</span>
                    <span className="badge badgeExpired">{v.severity || "medium"}</span>
                    <span className="mutedCell">{v.country || "—"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── SYSTEM LOGS ── */}
        <div className="dashCard logsCard">
          <div className="cardHeader">
            <span className="cardTitle">System logs</span>
            <div style={{ display: "flex", gap: "0.8rem" }}>
              <span className="badge badgePremium">✓ ok</span>
              <span className="badge badgeExpired">✗ err</span>
              <span className="badge badgeAmber">⚠ warn</span>
            </div>
          </div>
          {mockLogs.map((log, i) => (
            <LogRow key={i} {...log} />
          ))}
        </div>

        <div className="dashFooter">
          Legal RAG Admin · Auto-refreshes every 30s · Queue polls every 10s
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;