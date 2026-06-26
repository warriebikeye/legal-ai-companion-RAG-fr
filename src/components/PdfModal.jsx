// src/components/PdfModal.jsx
//
// Generates and downloads a professionally formatted Clauzify legal PDF.
//
// Features:
//   - Topic derived client-side: markdown heading → cleaned first sentence (no LLM call)
//   - SVG logo converted to PNG at runtime via canvas (logoUrl prop)
//   - Compact 28mm header: logo+appname left | business name+user right
//   - Navy background behind logo box
//   - Free-tier: 1 download/day via localStorage; Premium: unlimited
//
// Dependencies: jsPDF  →  npm install jspdf
//
// Usage in HomePage.jsx:
//   import gptimglogo from '../assets/DeeBees.svg';
//   <PdfModal responseText={...} sources={...} logoUrl={gptimglogo} onClose={...} />

import { useState, useCallback, useEffect } from "react";
import { jsPDF } from "jspdf";
import { readAuthCookie } from "../hooks/useAuthCookie";

/* =========================================================
   RATE LIMIT HELPERS
========================================================= */
const LIMIT_KEY = "clauzify_pdf_last_download";

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}
function hasUsedDownloadToday() {
  try { return localStorage.getItem(LIMIT_KEY) === getTodayDateString(); }
  catch { return false; }
}
function markDownloadUsed() {
  try { localStorage.setItem(LIMIT_KEY, getTodayDateString()); }
  catch { /* silent */ }
}

/* =========================================================
   TOPIC DERIVER  (pure client-side, no API call)

   Priority order:
     1. First markdown heading (## Title) — Gemini uses these often
     2. First meaningful sentence, with:
          - Leading legal preambles stripped ("Under Nigerian law, ")
          - Trailing jurisdiction tails stripped ("...under the Labour Act")
          - Graceful truncation at 65 chars / word boundary
========================================================= */
const PREAMBLE_RE = /^(under|in|according to|pursuant to|by virtue of)\s+[\w\s,]+?(law|laws|the law|act|code)[,.]?\s*/i;
const TAIL_RE     = /\s+(under|in|by|from|pursuant|as defined|as provided)[^,]*?(law|act|code|nigeria|kenya|ghana|africa)[^,]*$/i;

function deriveTopic(text = "") {
  // 1. Markdown heading
  const headingMatch = text.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim().replace(/[.,;:]+$/, "");
  }

  // 2. First meaningful sentence from plain text
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/_([^_]+)_/g, "$1")
    .trim();

  let first = clean.split("\n").find((l) => l.trim().length > 10) || "Legal Research";

  // Strip leading preamble: "Under Nigerian law, " / "In Kenya, "
  first = first.replace(PREAMBLE_RE, "").trim();

  // Capitalise first letter after stripping
  if (first.length > 0) first = first[0].toUpperCase() + first.slice(1);

  // Strip trailing jurisdictional tail: "...under the Labour Act"
  first = first.replace(TAIL_RE, "").trim();

  // Truncate gracefully at word boundary
  if (first.length > 65) {
    first = first.slice(0, 65).replace(/\s+\S*$/, "");
  }

  return first.replace(/[.,;:]+$/, "") || "Legal Research";
}

/* =========================================================
   SVG → PNG runtime conversion
========================================================= */
async function svgToPngDataUrl(svgUrl, sizePx = 64) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = sizePx; canvas.height = sizePx;
        canvas.getContext("2d").drawImage(img, 0, 0, sizePx, sizePx);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = svgUrl;
    } catch { resolve(null); }
  });
}

/* =========================================================
   MARKDOWN STRIPPER
========================================================= */
function stripMarkdown(text = "") {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

/* =========================================================
   PDF GENERATOR
========================================================= */
async function generatePDF({ responseText, sources, userName, businessName, logoDataUrl }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const PAGE_W       = 210;
  const PAGE_H       = 297;
  const ML           = 20;
  const MR           = 20;
  const CONTENT_W    = PAGE_W - ML - MR;
  const HEADER_H     = 28;
  const FOOTER_H     = 14;
  const CONTENT_START = HEADER_H + 6;

  const NAVY       = [15, 30, 68];
  const DARK_GREY  = [26, 26, 26];
  const MID_GREY   = [119, 119, 119];
  const LIGHT_GREY = [222, 222, 222];
  const OFF_WHITE  = [247, 247, 249];
  const WHITE      = [255, 255, 255];
  const BLACK      = [26, 26, 26];

  const TODAY = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const topic   = deriveTopic(responseText);
  const docTitle = `Clauzify Report on ${topic}`;

  // ── Header + footer stamped on every page after build ────
  const drawHeaderFooter = (pageNum, totalPages) => {
    doc.setPage(pageNum);

    doc.setFillColor(...OFF_WHITE);
    doc.rect(0, 0, PAGE_W, HEADER_H, "F");
    doc.setFillColor(...NAVY);
    doc.rect(0, HEADER_H, PAGE_W, 0.6, "F");

    const CENTER_Y  = HEADER_H / 2;
    const LOGO_SIZE = 10;
    const LOGO_X    = ML;
    const LOGO_Y    = CENTER_Y - LOGO_SIZE / 2;

    // Navy logo box
    doc.setFillColor(...NAVY);
    doc.roundedRect(LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE, 1, 1, "F");

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", LOGO_X, LOGO_Y, LOGO_SIZE, LOGO_SIZE);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      doc.text("C", LOGO_X + LOGO_SIZE / 2, LOGO_Y + LOGO_SIZE / 2 + 2, { align: "center" });
    }

    // App name + tagline
    const TEXT_X = LOGO_X + LOGO_SIZE + 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("Clauzify", TEXT_X, CENTER_Y + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...MID_GREY);
    doc.text("Africa's Legal Intelligence Engine", TEXT_X, CENTER_Y + 5.5);

    // Business name right-aligned (dominant)
    if (businessName?.trim()) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(...DARK_GREY);
      const bw = doc.getTextWidth(businessName.trim());
      doc.text(businessName.trim(), PAGE_W - MR - bw, CENTER_Y + 2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MID_GREY);
      const uw = doc.getTextWidth(userName.trim());
      doc.text(userName.trim(), PAGE_W - MR - uw, CENTER_Y + 7.5);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...DARK_GREY);
      const uw = doc.getTextWidth(userName.trim());
      doc.text(userName.trim(), PAGE_W - MR - uw, CENTER_Y + 2);
    }

    // Footer
    doc.setFillColor(...OFF_WHITE);
    doc.rect(0, PAGE_H - 11, PAGE_W, 11, "F");
    doc.setFillColor(...NAVY);
    doc.rect(0, PAGE_H - 11, PAGE_W, 0.5, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...MID_GREY);
    doc.text(
      "Generated by Clauzify — Africa's Legal Intelligence Engine. This is not legal advice.",
      ML, PAGE_H - 4
    );

    const pageStr = `Page ${pageNum} of ${totalPages}  ·  ${TODAY}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...DARK_GREY);
    doc.text(pageStr, PAGE_W - MR - doc.getTextWidth(pageStr), PAGE_H - 4);
  };

  // ── Content ───────────────────────────────────────────────
  const LINE_H = 5.5;
  let y = CONTENT_START;

  const checkPageBreak = (needed = LINE_H) => {
    if (y + needed > PAGE_H - FOOTER_H) { doc.addPage(); y = CONTENT_START; }
  };

  const writeLine = (text, fontStyle, fontSize, color, indent = 0) => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    doc.splitTextToSize(text || " ", CONTENT_W - indent).forEach((line) => {
      checkPageBreak();
      doc.text(line, ML + indent, y);
      y += LINE_H;
    });
  };

  // Document title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.splitTextToSize(docTitle, CONTENT_W).forEach((line) => {
    doc.text(line, ML, y); y += 7;
  });

  y += 2;
  doc.setDrawColor(...LIGHT_GREY);
  doc.setLineWidth(0.4);
  doc.line(ML, y, PAGE_W - MR, y);
  y += 6;

  // Body
  for (const raw of stripMarkdown(responseText).split("\n")) {
    const line = raw.trim();
    if (!line) { y += 2; continue; }

    const isHeading =
      (line === line.toUpperCase() && line.length > 4 && line.length < 80) ||
      /^\*\*/.test(raw);

    if (isHeading)                             { y += 2; writeLine(line, "bold", 10.5, NAVY); }
    else if (line.startsWith("•"))               writeLine(line, "normal", 9.5, BLACK, 4);
    else if (line.startsWith("_") && line.endsWith("_"))
      writeLine(line.replace(/^_|_$/g, ""), "italic", 8, MID_GREY);
    else                                         writeLine(line, "normal", 9.5, BLACK);
  }

  // Sources
  if (sources?.length > 0) {
    y += 4; checkPageBreak(20);
    doc.setDrawColor(...LIGHT_GREY); doc.setLineWidth(0.4);
    doc.line(ML, y, PAGE_W - MR, y); y += 5;
    writeLine("SOURCES", "bold", 9, DARK_GREY);
    sources.forEach((src, idx) => writeLine(`${idx + 1}.  ${src}`, "normal", 8.5, MID_GREY));
  }

  // Signature block
  if (y + 45 > PAGE_H - FOOTER_H) { doc.addPage(); y = CONTENT_START; }
  y += 8;
  doc.setDrawColor(...LIGHT_GREY); doc.setLineWidth(0.4);
  doc.line(ML, y, PAGE_W - MR, y); y += 8;

  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...MID_GREY);
  doc.text("Date: ___________________________", ML, y);
  doc.text("Signature: _______________________", ML + CONTENT_W * 0.48, y);
  y += 12;

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...BLACK);
  doc.text(userName.trim(), ML, y);
  if (businessName?.trim()) {
    y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...MID_GREY);
    doc.text(businessName.trim(), ML, y);
  }

  // Stamp header/footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) drawHeaderFooter(p, totalPages);

  const safeName = userName.trim().replace(/\s+/g, "_");
  const dateStr  = new Date().toISOString().slice(0, 10);
  doc.save(`Clauzify_Legal_Report_${safeName}_${dateStr}.pdf`);
}

/* =========================================================
   MODAL COMPONENT
========================================================= */
export default function PdfModal({ responseText, sources = [], onClose, logoUrl }) {
  const [userName, setUserName]         = useState("");
  const [businessName, setBusinessName] = useState("");
  const [generating, setGenerating]     = useState(false);
  const [error, setError]               = useState("");
  const [limitHit, setLimitHit]         = useState(false);

  const cookie    = readAuthCookie();
  const isPremium = cookie?.subscriptionTier === "premium";

  useEffect(() => {
    if (!isPremium && hasUsedDownloadToday()) setLimitHit(true);
  }, [isPremium]);

  const handleGenerate = useCallback(async () => {
    if (!userName.trim()) { setError("Please enter your name."); return; }
    if (!isPremium && hasUsedDownloadToday()) { setLimitHit(true); return; }

    setError("");
    setGenerating(true);

    try {
      const logoDataUrl = logoUrl ? await svgToPngDataUrl(logoUrl, 64) : null;
      await generatePDF({ responseText, sources, userName, businessName, logoDataUrl });
      if (!isPremium) markDownloadUsed();
      onClose();
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [userName, businessName, responseText, sources, isPremium, logoUrl, onClose]);

  const blocked = generating || limitHit;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>📄 Generate Legal PDF</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <p style={styles.subtitle}>
          Creates a formatted document with your details, the legal response, and a signature block.
        </p>

        {limitHit && (
          <div style={styles.limitBanner}>
            <strong>Daily limit reached.</strong> Free accounts can download one PDF per day.{" "}
            <span style={styles.upgradeLink} onClick={() => window.location.href = "/upgrade"}>
              Upgrade to Pro
            </span>{" "}
            for unlimited downloads.
          </div>
        )}

        {!limitHit && (
          <div style={isPremium ? styles.proBadge : styles.freeBadge}>
            {isPremium ? "✓ Pro — unlimited downloads" : "Free plan — 1 download per day"}
          </div>
        )}

        <label style={styles.label}>Your Name <span style={styles.required}>*</span></label>
        <input
          style={{ ...styles.input, opacity: limitHit ? 0.5 : 1 }}
          placeholder="e.g. Emeka Okafor"
          value={userName}
          onChange={(e) => { setUserName(e.target.value); setError(""); }}
          disabled={limitHit}
        />

        <label style={styles.label}>
          Business Name <span style={styles.optional}>(optional)</span>
        </label>
        <input
          style={{ ...styles.input, opacity: limitHit ? 0.5 : 1 }}
          placeholder="e.g. Okafor & Associates"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          disabled={limitHit}
        />

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.generateBtn, opacity: blocked ? 0.5 : 1, cursor: blocked ? "not-allowed" : "pointer" }}
            onClick={handleGenerate}
            disabled={blocked}
          >
            {generating ? "Generating…" : "⬇ Download PDF"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   STYLES
========================================================= */
const styles = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: "16px",
  },
  modal: {
    background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: "12px",
    padding: "28px 24px", width: "100%", maxWidth: "420px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  modalTitle: { color: "#e0e0f0", fontWeight: "700", fontSize: "17px" },
  closeBtn: { background: "none", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer", lineHeight: 1 },
  subtitle: { color: "#9090b0", fontSize: "12.5px", marginBottom: "16px", lineHeight: 1.5 },
  limitBanner: {
    background: "#2a1a1a", border: "1px solid #7a2020", borderRadius: "8px",
    padding: "10px 14px", color: "#f08080", fontSize: "12.5px", marginBottom: "16px", lineHeight: 1.5,
  },
  upgradeLink: { color: "#a0c8ff", textDecoration: "underline", cursor: "pointer" },
  proBadge: {
    background: "#0f2a1a", border: "1px solid #1a5a30", borderRadius: "6px",
    padding: "6px 12px", color: "#4caf80", fontSize: "11.5px", marginBottom: "16px", display: "inline-block",
  },
  freeBadge: {
    background: "#1a1a2a", border: "1px solid #333", borderRadius: "6px",
    padding: "6px 12px", color: "#8888aa", fontSize: "11.5px", marginBottom: "16px", display: "inline-block",
  },
  label: { display: "block", color: "#ccd", fontSize: "12.5px", fontWeight: "600", marginBottom: "6px" },
  required: { color: "#e55", marginLeft: "2px" },
  optional: { color: "#888", fontWeight: "400", marginLeft: "4px" },
  input: {
    display: "block", width: "100%", boxSizing: "border-box",
    background: "#0f0f1e", border: "1px solid #333", borderRadius: "8px",
    padding: "10px 12px", color: "#eee", fontSize: "14px", marginBottom: "16px", outline: "none",
  },
  error: { color: "#f55", fontSize: "12px", marginBottom: "12px" },
  actions: { display: "flex", gap: "10px", marginTop: "8px" },
  cancelBtn: {
    flex: 1, padding: "11px", background: "transparent", border: "1px solid #444",
    borderRadius: "8px", color: "#aaa", fontSize: "14px", cursor: "pointer",
  },
  generateBtn: {
    flex: 2, padding: "11px", background: "linear-gradient(135deg, #0f3460, #1a237e)",
    border: "1px solid #4a5a9a", borderRadius: "8px", color: "#d0d8ff",
    fontSize: "14px", fontWeight: "700",
  },
};