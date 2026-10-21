import { REPORT_LOGO } from "./document-report-logo"

export const REPORT_FONTS = {
  gothic: { label: "맑은 고딕", css: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif' },
  noto: { label: "Noto Sans KR", css: '"Noto Sans KR", "Malgun Gothic", sans-serif' },
  serif: { label: "바탕", css: 'Batang, "AppleMyungjo", serif' },
  arial: { label: "Arial", css: 'Arial, "Malgun Gothic", sans-serif' },
} as const
export type ReportStyle = {
  font?: keyof typeof REPORT_FONTS
  size?: number
  spacing?: number
  lineHeight?: number
  align?: "left" | "center" | "right" | "justify"
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string
  spaceAfter?: number
  pageBreak?: boolean
}
export type ReportField = { text?: string; style?: ReportStyle }
export type ReportSection = { heading: string; content: string }
export type DocumentReport = {
  title: string; date: string; author: string; sections: ReportSection[]
  fields?: Record<string, ReportField>
  page?: { margin?: number; logoWidth?: number }
}
export type ReportBlock = { type: "paragraph" | "subheading" | "item"; text: string } | { type: "table"; rows: string[][] }
export type SelectableField = { key: string; label: string; text: string; kind: "title" | "heading" | "subheading" | "body" | "cell" | "meta" }
const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ", "Ⅵ", "Ⅶ", "Ⅷ", "Ⅸ", "Ⅹ"]
export function sectionNumber(index: number) { return ROMAN[index] || String(index + 1) }

export function formatDocumentReport(source: string, metadata: Pick<DocumentReport, "title" | "date" | "author">): DocumentReport {
  const sections: ReportSection[] = []
  let current: ReportSection = { heading: "주요 내용", content: "" }
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = line.trim().match(/^(?:#\s+(.+)|\[([^\]]+)\]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*[.．、]?\s*(.+)|\d+[.．]\s+(.+)|(개요|보고 개요|배경|목적|주요 내용|진행 현황|추진 내용|검토 사항|문제점|향후 계획|추진 계획|요청 사항|결론)\s*[:：]?\s*)$/)
    if (heading) {
      if (current.content.trim() || current.heading !== "주요 내용") sections.push({ ...current, content: current.content.trim() })
      current = { heading: heading.slice(1).find(Boolean) || "주요 내용", content: "" }
    } else current.content += `${line}\n`
  }
  if (current.content.trim() || current.heading !== "주요 내용") sections.push({ ...current, content: current.content.trim() })
  return { ...metadata, sections }
}

export function reportBlocks(content: string): ReportBlock[] {
  const blocks: ReportBlock[] = []
  let tableOpen = false
  for (const line of content.split("\n")) {
    const text = line.trim()
    if (!text) { tableOpen = false; continue }
    if (line.includes("\t") || /^\|.*\|$/.test(text)) {
      const cells = line.includes("\t") ? line.split("\t") : text.slice(1, -1).split("|")
      if (cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) continue
      const previous = blocks[blocks.length - 1]
      const row = cells.map(cell => cell.trim())
      if (tableOpen && previous?.type === "table") previous.rows.push(row)
      else blocks.push({ type: "table", rows: [row] })
      tableOpen = true
    } else {
      tableOpen = false
      if (/^(?:#{2,3}\s+|[가-하][.．]\s*|\d+\)\s*)/.test(text)) blocks.push({ type: "subheading", text: text.replace(/^#{2,3}\s+/, "") })
      else if (/^[-*•·]\s+/.test(text)) blocks.push({ type: "item", text: text.replace(/^[-*•·]\s+/, "") })
      else blocks.push({ type: "paragraph", text })
    }
  }
  return blocks
}

export function reportFields(report: DocumentReport): SelectableField[] {
  const fields: SelectableField[] = [
    { key: "title", label: "보고서 제목", text: report.title, kind: "title" },
    { key: "author", label: "작성 부서 / 작성자", text: report.author, kind: "meta" },
    { key: "date", label: "작성일", text: report.date, kind: "meta" },
  ]
  report.sections.forEach((section, si) => {
    fields.push({ key: `s${si}.heading`, label: `${sectionNumber(si)}. 큰 제목`, text: section.heading, kind: "heading" })
    reportBlocks(section.content).forEach((block, bi) => {
      const key = `s${si}.b${bi}`
      if (block.type === "table") {
        const width = Math.max(...block.rows.map(row => row.length))
        block.rows.forEach((row, ri) => Array.from({ length: width }, (_, ci) => {
          fields.push({ key: `${key}.r${ri}.c${ci}`, label: `표 ${ri + 1}행 ${ci + 1}열`, text: row[ci] || "", kind: "cell" })
        }))
      } else fields.push({ key, label: block.type === "subheading" ? "소제목" : "본문", text: block.text, kind: block.type === "subheading" ? "subheading" : "body" })
    })
  })
  return fields
}

export function fieldText(report: DocumentReport, key: string, fallback: string) {
  return typeof report.fields?.[key]?.text === "string" ? report.fields[key].text! : fallback
}
export function defaultFieldStyle(kind: SelectableField["kind"]): ReportStyle {
  return { font: "gothic", size: kind === "title" ? 23 : kind === "heading" ? 15 : kind === "subheading" ? 11.5 : kind === "meta" ? 9 : kind === "cell" ? 10 : 10.5,
    spacing: 0, lineHeight: kind === "title" ? 1.45 : kind === "heading" ? 1.6 : 1.75, align: kind === "title" ? "center" : kind === "meta" ? "right" : kind === "cell" ? "center" : "left",
    bold: ["title", "heading", "subheading"].includes(kind), color: "#172b35", spaceAfter: kind === "title" ? 24 : kind === "heading" ? 12 : kind === "subheading" ? 8 : kind === "meta" ? 0 : 6 }
}
function bounded(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
function fieldCss(style: ReportStyle = {}) {
  const css: string[] = []
  if (style.font && Object.hasOwn(REPORT_FONTS, style.font)) css.push(`font-family:${REPORT_FONTS[style.font].css}`)
  if (style.size != null) css.push(`font-size:${bounded(style.size, 7, 48, 10.5)}pt`)
  if (style.spacing != null) css.push(`letter-spacing:${bounded(style.spacing, 0, 8, 0)}px`)
  if (style.lineHeight != null) css.push(`line-height:${bounded(style.lineHeight, 1, 3, 1.75)}`)
  if (style.spaceAfter != null) css.push(`margin-bottom:${bounded(style.spaceAfter, 0, 48, 6)}px`)
  if (style.align && ["left", "center", "right", "justify"].includes(style.align)) css.push(`text-align:${style.align}`)
  if (typeof style.bold === "boolean") css.push(`font-weight:${style.bold ? 700 : 400}`)
  if (typeof style.italic === "boolean") css.push(`font-style:${style.italic ? "italic" : "normal"}`)
  if (typeof style.underline === "boolean") css.push(`text-decoration:${style.underline ? "underline" : "none"}`)
  if (style.color && /^#[0-9a-f]{6}$/i.test(style.color)) css.push(`color:${style.color}`)
  if (style.pageBreak) css.push("break-before:page")
  return css.join(";")
}
function escapeHtml(text: string) {
  return String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}

export const REPORT_CSS = `
.company-report{box-sizing:border-box;background:#fff;color:#172b35;font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:10.5pt;line-height:1.75;letter-spacing:0;overflow-wrap:anywhere;word-break:normal;}
.company-report *{box-sizing:border-box;}
.company-report .report-brand{display:flex;align-items:center;margin-bottom:32px;}
.company-report .report-logo{display:block;height:auto;object-fit:contain;}
.company-report .report-header{border-bottom:2px solid #12323e;padding-bottom:20px;margin-bottom:26px;}
.company-report h1{font-size:23pt;line-height:1.45;text-align:center;font-weight:700;margin:0 0 24px;white-space:pre-wrap;}
.company-report .report-meta{display:flex;justify-content:flex-end;gap:18px;align-items:baseline;font-size:9pt;color:#52636b;}
.company-report .report-author,.company-report .report-date{white-space:pre-wrap;text-align:right;}
.company-report h2{font-size:15pt;line-height:1.6;font-weight:700;margin:28px 0 12px;padding:0 0 7px;border-bottom:1px solid #b5c6cd;break-after:avoid;white-space:pre-wrap;}
.company-report h2 .section-number{color:#147eaa;padding-right:9px;}
.company-report h3{font-size:11.5pt;font-weight:700;margin:18px 0 8px;break-after:avoid;white-space:pre-wrap;}
.company-report .report-body{padding-left:8px;}
.company-report p{margin:0 0 6px;white-space:pre-wrap;orphans:3;widows:3;}
.company-report .report-item{padding-left:14px;position:relative;}
.company-report .report-item:before{content:"–";position:absolute;left:0;color:#547987;}
.company-report table{width:100%;border-collapse:collapse;table-layout:fixed;margin:18px 0;font-size:10pt;}
.company-report th,.company-report td{border:1px solid #b5c6cd;padding:9px 10px;text-align:center;vertical-align:middle;overflow-wrap:anywhere;white-space:pre-wrap;}
.company-report th{background:#e4f0f6;color:#173a4b;font-weight:700;border-top:2px solid #547987;}
.company-report tbody tr:nth-child(even){background:#f7fafc;}
.company-report thead{display:table-header-group;}
.company-report tr{break-inside:avoid;}
.report-editor-paper [data-report-field]{cursor:text;border-radius:2px;outline:2px solid transparent;outline-offset:3px;transition:outline-color .12s;}
.report-editor-paper [data-report-field]:hover{outline-color:#bfdbfe;}
.report-editor-paper [data-report-field][data-selected=true]{outline-color:#2563eb;background-color:#eff6ff;}
.report-editor-paper [data-report-field][data-peer=true]{box-shadow:inset 0 0 0 1px #0d9488;}
@media print{html,body{margin:0;padding:0;background:#fff;}.company-report{width:100%;padding:0!important;} .company-report th,.company-report tr{print-color-adjust:exact;-webkit-print-color-adjust:exact;}[data-report-field]{outline:none!important;}}
`

export function reportHtml(report: DocumentReport, fragment = false, selected = "", peers: Record<string, string> = {}) {
  const margin = bounded(report.page?.margin, 10, 30, 18)
  const logoWidth = bounded(report.page?.logoWidth, 80, 220, 145)
  const attrs = (key: string) => ` data-report-field="${key}"${fragment ? ` tabindex="0"${selected === key ? ' data-selected="true"' : ""}${peers[key] ? ` data-peer="true" title="${escapeHtml(peers[key])} 님 편집 중"` : ""}` : ""} style="${escapeHtml(fieldCss(report.fields?.[key]?.style))}"`
  const text = (key: string, fallback: string) => escapeHtml(fieldText(report, key, fallback))
  const sections = report.sections.map((section, si) => `<section><h2${attrs(`s${si}.heading`)}><span class="section-number">${sectionNumber(si)}.</span>${text(`s${si}.heading`, section.heading)}</h2><div class="report-body">${reportBlocks(section.content).map((block, bi) => {
    const key = `s${si}.b${bi}`
    if (block.type === "table") {
      const width = Math.max(...block.rows.map(row => row.length))
      const rowHtml = (row: string[], ri: number) => `<tr>${Array.from({ length: width }, (_, ci) => {
        const tag = ri === 0 ? "th" : "td"
        const cellKey = `${key}.r${ri}.c${ci}`
        return `<${tag}${ri === 0 ? ' scope="col"' : ""}${attrs(cellKey)}>${text(cellKey, row[ci] || "")}</${tag}>`
      }).join("")}</tr>`
      return `<table><thead>${rowHtml(block.rows[0], 0)}</thead><tbody>${block.rows.slice(1).map((row, ri) => rowHtml(row, ri + 1)).join("")}</tbody></table>`
    }
    const tag = block.type === "subheading" ? "h3" : "p"
    return `<${tag}${block.type === "item" ? ' class="report-item"' : ""}${attrs(key)}>${text(key, block.text)}</${tag}>`
  }).join("")}</div></section>`).join("")
  const article = `<article class="company-report" style="padding:${margin}mm"><header class="report-header"><div class="report-brand"><img class="report-logo" width="${logoWidth}" src="${REPORT_LOGO}" alt="INFOMAX"></div><h1${attrs("title")}>${text("title", report.title)}</h1><div class="report-meta"><div class="report-author"${attrs("author")}>작성 : ${text("author", report.author)}</div><div class="report-date"${attrs("date")}>${text("date", report.date)}</div></div></header>${sections}</article>`
  return fragment ? article : `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${text("title", report.title)}</title><style>${REPORT_CSS}\n@page{size:A4;margin:${margin}mm;}</style></head><body>${article}</body></html>`
}

export function reportPlainText(report: DocumentReport) {
  return [fieldText(report, "title", report.title), `작성일: ${fieldText(report, "date", report.date)}`, `작성: ${fieldText(report, "author", report.author)}`,
    ...report.sections.flatMap((section, si) => ["", `${sectionNumber(si)}. ${fieldText(report, `s${si}.heading`, section.heading)}`,
      ...reportBlocks(section.content).map((block, bi) => {
        const key = `s${si}.b${bi}`
        if (block.type === "table") return block.rows.map((row, ri) => row.map((cell, ci) => fieldText(report, `${key}.r${ri}.c${ci}`, cell)).join("\t")).join("\n")
        return `${block.type === "item" ? "- " : ""}${fieldText(report, key, block.text)}`
      })])].join("\n")
}
