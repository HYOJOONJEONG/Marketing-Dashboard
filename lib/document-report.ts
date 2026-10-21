export type ReportSection = { heading: string; content: string }
export type DocumentReport = { title: string; date: string; author: string; sections: ReportSection[] }
export type ReportBlock = { type: "paragraph" | "subheading" | "item"; text: string } | { type: "table"; rows: string[][] }
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"]
export function sectionNumber(index: number) { return ROMAN[index] || String(index + 1) }

export function formatDocumentReport(source: string, metadata: Omit<DocumentReport, "sections">): DocumentReport {
  const sections: ReportSection[] = []
  let current: ReportSection = { heading: "주요 내용", content: "" }
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = line.trim().match(/^(?:#\s+(.+)|\[([^\]]+)\]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*[.．、]?\s+(.+)|\d+[.．]\s+(.+)|(개요|보고 개요|배경|목적|주요 내용|진행 현황|추진 내용|검토 사항|문제점|향후 계획|추진 계획|요청 사항|결론)\s*[:：]?\s*)$/)
    if (heading) {
      if (current.content.trim()) sections.push({ ...current, content: current.content.trim() })
      current = { heading: heading.slice(1).find(Boolean) || "주요 내용", content: "" }
    } else {
      current.content += `${line}\n`
    }
  }
  if (current.content.trim()) sections.push({ ...current, content: current.content.trim() })
  return { ...metadata, sections }
}

export function reportPlainText(report: DocumentReport) {
  return [report.title, `작성일: ${report.date}`, `작성: ${report.author}`, ...report.sections.flatMap((section, i) => ["", `${sectionNumber(i)}. ${section.heading}`, section.content])].join("\n")
}

export function reportBlocks(content: string): ReportBlock[] {
  const blocks: ReportBlock[] = []
  for (const line of content.split("\n")) {
    const text = line.trim()
    if (!text) continue
    if (text.includes("\t") || /^\|.*\|$/.test(text)) {
      const cells = text.includes("\t") ? text.split("\t") : text.slice(1, -1).split("|")
      if (cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) continue
      const previous = blocks[blocks.length - 1]
      const row = cells.map(cell => cell.trim())
      if (previous?.type === "table") previous.rows.push(row)
      else blocks.push({ type: "table", rows: [row] })
    } else if (/^(?:#{2,3}\s+|[가-하][.．]\s*|\d+\)\s*)/.test(text)) {
      blocks.push({ type: "subheading", text: text.replace(/^#{2,3}\s+/, "") })
    } else if (/^[-*•·]\s+/.test(text)) blocks.push({ type: "item", text: text.replace(/^[-*•·]\s+/, "") })
    else blocks.push({ type: "paragraph", text })
  }
  return blocks
}

export const REPORT_CSS = `
.company-report { box-sizing:border-box; background:white; color:#111; font-family:Arial,"Malgun Gothic",sans-serif; font-size:14px; line-height:1.65; letter-spacing:0; padding:32px; overflow-wrap:anywhere; }
.company-report * { box-sizing:border-box; }
.company-report .report-brand { font-size:21px; color:#357f91; font-weight:900; margin-bottom:26px; }
.company-report h1 { font-size:26px; line-height:1.45; text-align:center; margin:0 0 18px; font-weight:800; }
.company-report .report-author { text-align:right; font-size:12px; font-weight:700; margin-bottom:20px; }
.company-report .report-date { text-align:right; font-size:11px; color:#555; }
.company-report h2 { font-size:20px; line-height:1.5; margin:26px 0 16px; padding-bottom:4px; border-bottom:1px solid #777; break-after:avoid; }
.company-report h3 { font-size:15px; font-weight:700; margin:18px 0 9px; break-after:avoid; }
.company-report .report-body { padding-left:16px; }
.company-report p { margin:5px 0; white-space:pre-wrap; }
.company-report .report-item { padding-left:16px; position:relative; }
.company-report .report-item:before { content:"-"; position:absolute; left:0; }
.company-report table { width:100%; border-collapse:collapse; table-layout:fixed; margin:16px 0; font-size:13px; }
.company-report th,.company-report td { border:1px solid #222; padding:8px; text-align:center; vertical-align:middle; overflow-wrap:anywhere; }
.company-report th { background:#cfe2f3; font-weight:700; }
.company-report thead { display:table-header-group; }
.company-report tr { break-inside:avoid; }
@media(max-width:600px) { .company-report { padding:20px 16px; } .company-report h1 { font-size:22px; } .company-report h2 { font-size:18px; } .company-report .report-body { padding-left:4px; } .company-report th,.company-report td { padding:5px; font-size:11px; } }
@page { size:A4; margin:18mm; }
@media print { html,body { margin:0; padding:0; background:white; } .company-report { width:100%; padding:0; font-size:11pt; } .company-report h1 { font-size:22pt; } .company-report h2 { font-size:16pt; } .company-report th { print-color-adjust:exact; -webkit-print-color-adjust:exact; } }
`
function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}
export function reportHtml(report: DocumentReport, fragment = false) {
  const sections = report.sections.map((section, i) => `<section><h2>${sectionNumber(i)}. ${escapeHtml(section.heading)}</h2><div class="report-body">${reportBlocks(section.content).map(block => {
    if (block.type === "table") {
      const width = Math.max(...block.rows.map(row => row.length))
      return `<table><thead><tr>${Array.from({ length: width }, (_, i) => `<th>${escapeHtml(block.rows[0][i] || "")}</th>`).join("")}</tr></thead><tbody>${block.rows.slice(1).map(row => `<tr>${Array.from({ length: width }, (_, i) => `<td>${escapeHtml(row[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    }
    const tag = block.type === "subheading" ? "h3" : "p"
    return `<${tag}${block.type === "item" ? ' class="report-item"' : ""}>${escapeHtml(block.text)}</${tag}>`
  }).join("")}</div></section>`).join("")
  const article = `<article class="company-report"><div class="report-brand">INFOMAX</div><h1>${escapeHtml(report.title)}</h1><div class="report-author">작성 : ${escapeHtml(report.author)}</div><div class="report-date">${escapeHtml(report.date)}</div>${sections}</article>`
  return fragment ? article : `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.title)}</title><style>${REPORT_CSS}</style></head><body>${article}</body></html>`
}
