// src/components/LegalAnalysisCard.jsx
import { useState } from 'react';
import './LegalAnalysisCard.css';

/* =========================================================
   SEVERITY DETECTOR
   Scans issue text for keywords to assign a risk level.
========================================================= */

function detectSeverity(text = '') {
  const t = text.toLowerCase();

  const highKeywords = [
    'illegal', 'null and void', 'void', 'criminal', 'prohibited',
    'unlawful', 'contravenes', 'violates', 'breach',
  ];
  const mediumKeywords = [
    'potentially', 'problematic', 'unclear', 'ambiguous',
    'may contradict', 'appears to contradict', 'could be', 'unfair',
  ];

  if (highKeywords.some((k) => t.includes(k))) return 'high';
  if (mediumKeywords.some((k) => t.includes(k))) return 'medium';
  return 'low';
}

/* =========================================================
   PARSER
   Converts the markdown-style bot response into structured
   issue objects: { title, clause, problem, source, severity }
========================================================= */

function parseIssues(text = '') {
  const issues = [];

  // Split on lines that look like bold top-level headings: * **Something:**
  // We capture each "block" between headings
  const lines = text.split('\n');

  let current = null;
  let inDisclaimer = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Disclaimer block — stop parsing issues
    if (line.startsWith('**Disclaimer') || line.startsWith('Disclaimer')) {
      inDisclaimer = true;
      if (current) { issues.push(current); current = null; }
      continue;
    }
    if (inDisclaimer) continue;

    // Top-level issue heading: * **Title:** or **Title:**
    const topHeadingMatch = line.match(/^\*?\s*\*\*([^*:]+):?\*\*\s*$/);
    if (topHeadingMatch) {
      if (current) issues.push(current);
      current = {
        title: topHeadingMatch[1].trim(),
        clause: '',
        problem: '',
        source: '',
        severity: 'low',
      };
      continue;
    }

    if (!current) continue;

    // Contract Clause
    if (line.match(/\*\*Contract Clause[:\*]*/i)) {
      current._section = 'clause';
      continue;
    }

    // Legal Problem
    if (line.match(/\*\*Legal Problem[:\*]*/i)) {
      current._section = 'problem';
      continue;
    }

    // Source
    if (line.match(/\*\*Source[:\*]*/i)) {
      current._section = 'source';
      // Inline source on same line
      const inlineSource = line.replace(/\*\*Source[:\*]*\**/i, '').replace(/`/g, '').trim();
      if (inlineSource) current.source += inlineSource + ' ';
      continue;
    }

    // Content lines — strip leading * and backticks
    const content = line.replace(/^\*+\s*/, '').replace(/`/g, '').trim();
    if (!content) continue;

    if (current._section === 'clause') {
      current.clause += (current.clause ? ' ' : '') + content;
    } else if (current._section === 'problem') {
      current.problem += (current.problem ? ' ' : '') + content;
    } else if (current._section === 'source') {
      current.source += content + ' ';
    }
  }

  if (current) issues.push(current);

  // Assign severity based on combined problem + title text
  return issues
    .filter((iss) => iss.title && (iss.clause || iss.problem))
    .map((iss) => ({
      ...iss,
      source: iss.source.trim(),
      clause: iss.clause.trim(),
      problem: iss.problem.trim(),
      severity: detectSeverity(iss.title + ' ' + iss.problem),
    }));
}

/* =========================================================
   EXTRACT DISCLAIMER
========================================================= */

function extractDisclaimer(text = '') {
  const match = text.match(/\*?\*?Disclaimer[:\*\*]*\s*([\s\S]+?)(?:Sources:|$)/i);
  return match ? match[1].replace(/\*/g, '').trim() : null;
}

/* =========================================================
   SEVERITY BADGE
========================================================= */

const SEVERITY_CONFIG = {
  high:   { label: 'High Risk',   className: 'severity-high'   },
  medium: { label: 'Medium Risk', className: 'severity-medium' },
  low:    { label: 'Low Risk',    className: 'severity-low'    },
};

function SeverityBadge({ level }) {
  const cfg = SEVERITY_CONFIG[level] || SEVERITY_CONFIG.low;
  return <span className={`severity-badge ${cfg.className}`}>{cfg.label}</span>;
}

/* =========================================================
   SINGLE ISSUE CARD
========================================================= */

function IssueCard({ issue, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`issue-card issue-card--${issue.severity}`}>
      <div
        className="issue-card__header"
        onClick={() => setExpanded((p) => !p)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="issue-card__header-left">
          <span className="issue-card__number">{String(index + 1).padStart(2, '0')}</span>
          <span className="issue-card__title">{issue.title}</span>
        </div>
        <div className="issue-card__header-right">
          <SeverityBadge level={issue.severity} />
          <span className={`issue-card__chevron ${expanded ? 'issue-card__chevron--open' : ''}`}>
            ▾
          </span>
        </div>
      </div>

      {expanded && (
        <div className="issue-card__body">
          {issue.clause && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">📄</span>
                Contract Clause
              </div>
              <blockquote className="issue-card__clause">
                "{issue.clause}"
              </blockquote>
            </div>
          )}

          {issue.problem && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">⚖️</span>
                Legal Problem
              </div>
              <p className="issue-card__problem">{issue.problem}</p>
            </div>
          )}

          {issue.source && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">📚</span>
                Legal Source
              </div>
              <div className="issue-card__source">{issue.source}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY BAR
========================================================= */

function SummaryBar({ issues }) {
  const counts = { high: 0, medium: 0, low: 0 };
  issues.forEach((i) => { counts[i.severity] = (counts[i.severity] || 0) + 1; });

  return (
    <div className="summary-bar">
      <div className="summary-bar__title">Contract Analysis Summary</div>
      <div className="summary-bar__counts">
        {counts.high > 0 && (
          <span className="summary-count summary-count--high">
            {counts.high} High Risk
          </span>
        )}
        {counts.medium > 0 && (
          <span className="summary-count summary-count--medium">
            {counts.medium} Medium Risk
          </span>
        )}
        {counts.low > 0 && (
          <span className="summary-count summary-count--low">
            {counts.low} Low Risk
          </span>
        )}
        {issues.length === 0 && (
          <span className="summary-count summary-count--low">No issues found</span>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LegalAnalysisCard({ text, sources = [] }) {
  const issues = parseIssues(text);
  const disclaimer = extractDisclaimer(text);
  const uniqueSources = [...new Set(sources.filter(Boolean))];

  // If parsing found no structured issues, fall back to plain text
  if (issues.length === 0) {
    return (
      <span className="legal-plain-text">{text}</span>
    );
  }

  return (
    <div className="legal-analysis">
      <SummaryBar issues={issues} />

      <div className="issue-list">
        {issues.map((issue, i) => (
          <IssueCard key={i} issue={issue} index={i} />
        ))}
      </div>

      {disclaimer && (
        <div className="legal-disclaimer">
          <span className="legal-disclaimer__icon">ℹ️</span>
          <p>{disclaimer}</p>
        </div>
      )}

      {uniqueSources.length > 0 && (
        <div className="legal-sources">
          <span className="legal-sources__label">Sources: </span>
          {uniqueSources.map((src, i) => (
            <span key={i} className="legal-source-chip">{src}</span>
          ))}
        </div>
      )}
    </div>
  );
}