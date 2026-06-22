/* src/components/NotificationPrompt.jsx
 *
 * Soft-ask UI shown before the real OS permission dialog.
 * Rendered by HomePage when promptVisible === true.
 * Matches the existing Clauzify dark modal aesthetic.
 */

export default function NotificationPrompt({ scenario, onAllow, onDismiss }) {
  const content = {
    first_query: {
      icon: "⚖️",
      heading: "Stay ahead of your queries",
      body: "Get notified the moment your daily legal queries reset — so you're never left waiting.",
      allow: "Notify Me",
    },
    limit_hit: {
      icon: "🔔",
      heading: "You've used today's queries",
      body: "We'll send you a notification the moment your limit resets at midnight. Don't miss it.",
      allow: "Yes, Notify Me",
    },
    scan_done: {
      icon: "📄",
      heading: "Document scan complete",
      body: "Want a heads-up for future scan results and query resets? We'll only notify when it matters.",
      allow: "Allow Notifications",
    },
  }[scenario] ?? {
    icon: "🔔",
    heading: "Stay informed",
    body: "Get notified about your query resets and document results.",
    allow: "Allow",
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.icon}>{content.icon}</div>
        <h3 style={styles.heading}>{content.heading}</h3>
        <p style={styles.body}>{content.body}</p>
        <div style={styles.actions}>
          <button style={styles.allowBtn} onClick={onAllow}>
            {content.allow}
          </button>
          <button style={styles.dismissBtn} onClick={onDismiss}>
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "flex-end",        // slides up from bottom — mobile-native feel
    justifyContent: "center",
    zIndex: 9999,
    padding: "0 0 24px 0",
  },
  card: {
    background: "#1e1e2e",
    borderRadius: "18px 18px 14px 14px",
    padding: "28px 24px 20px",
    maxWidth: "380px",
    width: "calc(100% - 32px)",
    textAlign: "center",
    boxShadow: "0 -4px 32px rgba(0,0,0,0.4)",
    animation: "slideUp 0.28s ease-out",
  },
  icon: {
    fontSize: "2.4rem",
    marginBottom: "12px",
  },
  heading: {
    color: "#ffffff",
    fontSize: "1.1rem",
    fontWeight: "700",
    margin: "0 0 10px",
    lineHeight: 1.3,
  },
  body: {
    color: "#a0a0b8",
    fontSize: "0.9rem",
    lineHeight: 1.55,
    margin: "0 0 22px",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  allowBtn: {
    background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "13px",
    fontSize: "0.95rem",
    fontWeight: "600",
    cursor: "pointer",
    letterSpacing: "0.02em",
  },
  dismissBtn: {
    background: "transparent",
    color: "#6b6b8a",
    border: "none",
    padding: "8px",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
};