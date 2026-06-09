import { useState, useEffect } from 'react';
import "./AdminDashboard.css";
import { useAdminStream } from '../hooks/useAdminStream';

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
  "#3a1fff", "#0f6e56", "#712b13",
  "#3c3489", "#633806", "#185fa5",
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
    : status === "expired" || status === "cancelled" ? "badgeExpired"
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

function HourlyChart({ hourly = [] }) {
  if (!hourly.length) return <div className="chartEmpty">No data</div>;
  const max = Math.max(...hourly.map((h) => h.count), 1);
  const show = hourly.filter((_, i) => i % 2 === 0);
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

function UsersTable({ users = [], loading }) {
  if (loading) return <div className="tableEmpty">Connecting…</div>;
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
            const isActive = Date.now() - new Date(u.lastActiveAt).getTime() < 5 * 60 * 1000;
            const isIdle = !isActive && Date.now() - new Date(u.lastActiveAt).getTime() < 60 * 60 * 1000;
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

  /* =========================================================
     ADMIN AUTH GATE
     Check /auth/me — if not authenticated or not admin,
     show access denied instead of the dashboard.
  ========================================================= */
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin]         = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data?.user?.role === "admin");
        setAuthChecked(true);
      })
      .catch(() => {
        setIsAdmin(false);
        setAuthChecked(true);
      });
  }, []);

  /* =========================================================
     SSE STREAM HOOK
  ========================================================= */
  const {
    data,
    queueData,
    connected,
    error,
    lastUpdate,
    forceRefresh,
  } = useAdminStream();

  const [tierFilter, setTierFilter] = useState("all");

  /* =========================================================
     DERIVED DATA
  ========================================================= */
  const u  = data?.users        || {};
  const q  = queueData          || data?.queue || {};
  const v  = data?.queryVolume  || {};
  const l  = data?.latency      || {};
  const m  = data?.modelUsage   || {};
  const h  = data?.health       || {};

  const allRecentUsers = data?.recentUsers || [];

  const recentUsers =
    tierFilter === "all"
      ? allRecentUsers
      : allRecentUsers.filter((u) => u.tier === tierFilter);

  const failures = q?.recentFailures || [];
  const queueMax = Math.max(q.waiting || 0, 20);

  const mockLogs = [
    { time: new Date().toLocaleTimeString(), level: "ok",  msg: "<strong>RAG</strong> completed — latency 1.2s, gemini-2.5-flash, 4 sources" },
    { time: new Date(Date.now() - 18000).toLocaleTimeString(), level: "ok",  msg: "<strong>WORKER</strong> ingestion job completed successfully" },
    { time: new Date(Date.now() - 44000).toLocaleTimeString(), level: "warn", msg: "<strong>CLAUSE_CHECKER</strong> non-fatal timeout after 5000ms" },
    { time: new Date(Date.now() - 90000).toLocaleTimeString(), level: "ok",  msg: "<strong>AUTH</strong> Email/password login — user joined" },
    { time: new Date(Date.now() - 140000).toLocaleTimeString(), level: "ok", msg: "<strong>RAG</strong> cache HIT — served in 43ms from Redis" },
    ...failures.map((f) => ({
      time: f.timestamp ? new Date(f.timestamp).toLocaleTimeString() : "—",
      level: "err",
      msg: `<strong>QUEUE</strong> job #${f.id} failed after ${f.attemptsMade} attempts — ${f.failedReason || "unknown"}`,
    })),
  ];

  /* =========================================================
     RENDER — auth not checked yet, show nothing
  ========================================================= */
  if (!authChecked) return null;

  /* =========================================================
     RENDER — not admin
  ========================================================= */
  if (!isAdmin) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(3, 0, 31)",
        color: "white",
        fontFamily: "Poppins, sans-serif",
        gap: "1.2rem",
      }}>
        <h2 style={{ fontSize: "2.4rem" }}>⛔ Access Denied</h2>
        <p style={{ opacity: 0.6, fontSize: "1.5rem" }}>
          You don't have permission to view this page.
        </p>
      </div>
    );
  }

  /* =========================================================
     RENDER — loading (SSE not yet delivered first snapshot)
  ========================================================= */
  if (!data && !error) {
    return (
      <div className="dashPage">
        <div className="loadingState">
          <div className="spinner" />
          <p>Connecting to dashboard stream…</p>
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER — SSE error with no cached data
  ========================================================= */
  if (error && !data) {
    return (
      <div className="dashPage">
        <div className="errorState">
          <h2>⚠ {error}</h2>
          <button className="refreshBtn" onClick={forceRefresh}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER — dashboard
  ========================================================= */
  return (
    <div className="dashPage">
      <div className="dashContainer">

        {/* ── TOP BAR ── */}
        <div className="topBar">
          <div className="topBarLeft">
            <h1 className="dashTitle">Clauzify — Monitor Dash</h1>
            <div className="topBarMeta">
              <span className={`healthPill ${connected ? "pillGreen" : "pillRed"}`}>
                <span className={`dot ${connected ? "dotGreen" : "dotRed"}`} />
                {connected
                  ? h.mongodb === "connected" ? "All systems operational" : "Degraded"
                  : "Reconnecting…"}
              </span>
              <span className="uptime">Uptime {Math.floor((h.uptime || 0) / 3600)}h</span>
              {lastUpdate && (
                <span className="lastRefresh">
                  Updated {timeAgo(lastUpdate)}
                </span>
              )}
              {error && data && (
                <span className="pill pillRed" style={{ fontSize: "1.1rem" }}>
                  ⚠ Stream issue — showing last snapshot
                </span>
              )}
            </div>
          </div>
          <button className="refreshBtn" onClick={forceRefresh}>
            ↻ Refresh
          </button>
        </div>

        {/* ── HEALTH STRIP ── */}
        <div className="healthStrip">
          {[
            { label: "MongoDB", val: h.mongodb },
            { label: "Qdrant",  val: h.qdrant  },
            { label: "Redis",   val: h.redis   },
          ].map(({ label, val }) => (
            <div key={label} className="healthChip">
              <span className={`dot ${val === "connected" ? "dotGreen" : "dotRed"}`} />
              <span className="healthLabel">{label}</span>
              <span className={`healthVal ${val === "connected" ? "textGreen" : "textRed"}`}>
                {val || "—"}
              </span>
            </div>
          ))}
          <div className="healthChip">
            <span className={`dot ${q.overloaded ? "dotRed" : "dotGreen"}`} />
            <span className="healthLabel">Queue</span>
            <span className={`healthVal ${q.overloaded ? "textRed" : "textGreen"}`}>
              {q.status || "—"}
            </span>
          </div>
          <div className="healthChip">
            <span className={`dot ${connected ? "dotGreen" : "dotAmber"}`} />
            <span className="healthLabel">Stream</span>
            <span className={`healthVal ${connected ? "textGreen" : "textRed"}`}>
              {connected ? "live" : "reconnecting"}
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
              <span className={`smallPill ${connected ? "pillGreen" : "pillRed"}`}>
                <span className={`dot ${connected ? "dotGreen" : "dotRed"}`} />
                {connected ? "Live" : "Offline"}
              </span>
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
            <QueueBar label="Waiting"      value={q.waiting || 0} max={queueMax} colorClass="barBlue"  />
            <QueueBar label="Active"       value={q.active  || 0} max={queueMax} colorClass="barGreen" />
            <QueueBar label="Delayed"      value={q.delayed || 0} max={queueMax} colorClass="barAmber" />
            <QueueBar label="Failed (24h)" value={q.failed  || 0} max={queueMax} colorClass="barRed"   />
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
            <UsersTable users={recentUsers} loading={!data} />
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
          Legal RAG Admin · Full snapshot every 60s · Queue pushes every 5s via SSE
        </div>

      </div>
    </div>
  );
}

export default AdminDashboard;