// src/components/LegalAnalysisCard.jsx
import { useState } from 'react';
import './LegalAnalysisCard.css';

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
   HEALTH SCORE BAR
========================================================= */

function scoreClass(score) {
  if (score >= 85) return 'health-score--good';
  if (score >= 60) return 'health-score--medium';
  return 'health-score--bad';
}

function HealthScoreBar({ clauseAnalysis }) {
  const { healthScore, scoreBreakdown, overallRecommendation, truncated } = clauseAnalysis;

  if (healthScore === null || healthScore === undefined || !scoreBreakdown) return null;

  const { compliant, needsAttention, highRisk, missingMandatory } = scoreBreakdown;

  return (
    <div className="health-score-bar">
      <div className={`health-score-bar__score ${scoreClass(healthScore)}`}>
        Contract Health Score: {healthScore}/100
      </div>

      <div className="health-score-bar__counts">
        <div className="health-score-bar__row">
          <span className="health-score-bar__icon">🟢</span>
          Compliant Clauses: <strong>{compliant}</strong>
        </div>
        <div className="health-score-bar__row">
          <span className="health-score-bar__icon">🟡</span>
          Clauses Needing Attention: <strong>{needsAttention}</strong>
        </div>
        <div className="health-score-bar__row">
          <span className="health-score-bar__icon">🔴</span>
          High-Risk Clauses: <strong>{highRisk}</strong>
        </div>
        <div className="health-score-bar__row">
          <span className="health-score-bar__icon">❌</span>
          Missing Mandatory Clauses: <strong>{missingMandatory}</strong>
        </div>
      </div>

      {overallRecommendation && (
        <div className="health-score-bar__recommendation">
          <strong>Overall Recommendation:</strong> {overallRecommendation}
        </div>
      )}

      {truncated && (
        <div className="health-score-bar__caveat">
          ⚠️ This analysis is based on the first ~25,000 characters of a longer document.
        </div>
      )}

      <div className="health-score-bar__methodology">
        Score = share of expected clauses that are fine, weighted by severity — compliant clauses
        count fully, clauses needing attention count for half, and high-risk or missing mandatory
        clauses count for none.
      </div>
    </div>
  );
}

/* =========================================================
   SINGLE ISSUE CARD
========================================================= */

function IssueCard({ issue, index, applied, onApply }) {
  const [expanded, setExpanded] = useState(false);
  const isMissing = issue.status === 'missing';

  return (
    <div className={`issue-card issue-card--${issue.risk}`}>
      <div
        className="issue-card__header"
        onClick={() => setExpanded((p) => !p)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="issue-card__header-left">
          <span className="issue-card__number">{String(index + 1).padStart(2, '0')}</span>
          <span className="issue-card__title">{issue.clause}</span>
        </div>
        <div className="issue-card__header-right">
          {isMissing ? (
            <span className="severity-badge severity-high">Missing</span>
          ) : (
            <SeverityBadge level={issue.risk} />
          )}
          <span className={`issue-card__chevron ${expanded ? 'issue-card__chevron--open' : ''}`}>
            ▾
          </span>
        </div>
      </div>

      {expanded && (
        <div className="issue-card__body">
          {issue.clauseText && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">📄</span>
                Clause
              </div>
              <blockquote className="issue-card__clause">
                "{issue.clauseText}"
              </blockquote>
            </div>
          )}

          {issue.businessImpact && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">⚖️</span>
                Business Impact
              </div>
              <p className="issue-card__problem">{issue.businessImpact}</p>
            </div>
          )}

          {issue.legalBasis && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">📚</span>
                Legal Basis
              </div>
              <div className="issue-card__source">{issue.legalBasis}</div>
            </div>
          )}

          {issue.suggestedRevision && (
            <div className="issue-card__section">
              <div className="issue-card__section-label">
                <span className="issue-card__section-icon">✍️</span>
                Suggested Revision
              </div>
              <blockquote className="issue-card__clause">
                {issue.suggestedRevision}
              </blockquote>
            </div>
          )}

          {issue.suggestedRevision && (
            <button
              className={`apply-revision-btn ${applied ? 'apply-revision-btn--applied' : ''}`}
              disabled={applied}
              onClick={(e) => { e.stopPropagation(); onApply(); }}
            >
              {applied ? '✓ Applied' : '✅ Apply Suggested Revision'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LegalAnalysisCard({ clauseAnalysis, documentText, onDownloadRevised }) {
  const [workingDocumentText, setWorkingDocumentText] = useState(documentText || '');
  const [appliedIndices, setAppliedIndices] = useState(() => new Set());

  if (!clauseAnalysis || typeof clauseAnalysis !== 'object') return null;

  const issues = clauseAnalysis.issues || [];

  const handleApply = (issue, index) => {
    setWorkingDocumentText((prev) => {
      if (issue.status !== 'missing' && issue.clauseText && prev.includes(issue.clauseText)) {
        return prev.replace(issue.clauseText, issue.suggestedRevision);
      }
      // Missing clause (or clause text not found verbatim) — append instead of replacing
      const addition = `\n\n${issue.clause}\n${issue.suggestedRevision}`;
      if (prev.includes('Added Clauses')) {
        return prev + addition;
      }
      return `${prev}\n\n--- Added Clauses ---${addition}`;
    });
    setAppliedIndices((prev) => new Set(prev).add(index));
  };

  const hasAppliedRevisions = appliedIndices.size > 0;

  return (
    <div className="legal-analysis">
      <HealthScoreBar clauseAnalysis={clauseAnalysis} />

      {issues.length > 0 && (
        <div className="issue-list">
          {issues.map((issue, i) => (
            <IssueCard
              key={i}
              issue={issue}
              index={i}
              applied={appliedIndices.has(i)}
              onApply={() => handleApply(issue, i)}
            />
          ))}
        </div>
      )}

      {hasAppliedRevisions && documentText && (
        <button
          className="download-revised-btn"
          onClick={() => onDownloadRevised?.(workingDocumentText)}
        >
          ⬇ Download Revised Document
        </button>
      )}
    </div>
  );
}
