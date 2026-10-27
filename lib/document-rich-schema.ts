import { Extension, getSchema, Node as TiptapNode } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"
import { REPORT_FONTS, REPORT_TABLE_THEMES, reportTableColors } from "./document-report"

const Format = Extension.create({
  name: "reportFormat",
  addGlobalAttributes() {
    return [
      { types: ["tableCell", "tableHeader"], attributes: {
        backgroundColor: { default: null, parseHTML: element => element.getAttribute("data-cell-background"), renderHTML: attrs => /^#[0-9a-f]{6}$/i.test(attrs.backgroundColor || "") ? { "data-cell-background": attrs.backgroundColor, style: `background-color:${attrs.backgroundColor}` } : {} },
        cellBorderColor: { default: null, parseHTML: element => element.getAttribute("data-cell-border"), renderHTML: attrs => /^#[0-9a-f]{6}$/i.test(attrs.cellBorderColor || "") ? { "data-cell-border": attrs.cellBorderColor, style: `border-color:${attrs.cellBorderColor}` } : {} },
      } },
      { types: ["table"], attributes: {
        tableTheme: { default: "classic", parseHTML: element => element.getAttribute("data-table-theme") || "classic", renderHTML: attrs => ({ "data-table-theme": REPORT_TABLE_THEMES.some(theme => theme.value === attrs.tableTheme) ? attrs.tableTheme : "classic" }) },
        tableDensity: { default: "standard", parseHTML: element => element.getAttribute("data-table-density") || "standard", renderHTML: attrs => ({ "data-table-density": ["compact", "standard", "airy"].includes(attrs.tableDensity) ? attrs.tableDensity : "standard" }) },
        headerColor: { default: null, parseHTML: element => element.style.getPropertyValue("--report-table-header") || null, renderHTML: attrs => /^#[0-9a-f]{6}$/i.test(attrs.headerColor || "") ? { style: reportTableColors({ headerColor: attrs.headerColor }) } : {} },
        borderColor: { default: null, parseHTML: element => element.style.getPropertyValue("--report-table-border") || null, renderHTML: attrs => /^#[0-9a-f]{6}$/i.test(attrs.borderColor || "") ? { style: `--report-table-border:${attrs.borderColor}` } : {} },
      } },
      { types: ["paragraph", "heading"], attributes: {
        documentFont: { default: null, parseHTML: element => element.getAttribute("data-document-font"), renderHTML: attrs => Object.hasOwn(REPORT_FONTS, attrs.documentFont) ? { "data-document-font": attrs.documentFont, style: `font-family:${REPORT_FONTS[attrs.documentFont as keyof typeof REPORT_FONTS].css}` } : {} },
        reportKind: { default: null, parseHTML: element => element.getAttribute("data-report-kind"), renderHTML: attrs => attrs.reportKind ? { "data-report-kind": attrs.reportKind } : {} },
        lineHeight: { default: null, parseHTML: element => parseFloat(element.style.lineHeight) || null, renderHTML: attrs => attrs.lineHeight ? { style: `line-height:${Math.min(3, Math.max(1, Number(attrs.lineHeight)))}` } : {} },
        spaceAfter: { default: null, parseHTML: element => parseFloat(element.style.marginBottom) || null, renderHTML: attrs => attrs.spaceAfter != null ? { style: `margin-bottom:${Math.min(48, Math.max(0, Number(attrs.spaceAfter)))}px` } : {} },
        pageBreak: { default: false, parseHTML: element => element.style.breakBefore === "page", renderHTML: attrs => attrs.pageBreak ? { style: "break-before:page" } : {} },
      } },
      { types: ["textStyle"], attributes: {
        fontSize: { default: null, parseHTML: element => element.style.fontSize.endsWith("pt") ? parseFloat(element.style.fontSize) : null, renderHTML: attrs => attrs.fontSize ? { style: `font-size:${Math.min(48, Math.max(7, Number(attrs.fontSize)))}pt` } : {} },
        letterSpacing: { default: null, parseHTML: element => parseFloat(element.style.letterSpacing) || null, renderHTML: attrs => attrs.letterSpacing != null ? { style: `letter-spacing:${Math.min(8, Math.max(0, Number(attrs.letterSpacing)))}px` } : {} },
        fontFamily: { default: null, parseHTML: element => Object.entries(REPORT_FONTS).find(([, font]) => element.style.fontFamily === font.css)?.[0] || null, renderHTML: attrs => Object.hasOwn(REPORT_FONTS, attrs.fontFamily) ? { style: `font-family:${REPORT_FONTS[attrs.fontFamily as keyof typeof REPORT_FONTS].css}` } : {} },
      } },
    ]
  },
})

const ReportImage = TiptapNode.create({
  name: "reportImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "보고서 이미지" },
      width: { default: 640 },
      align: { default: "center" },
    }
  },
  parseHTML() { return [{ tag: "img[data-report-image]" }] },
  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes.src === "string" && HTMLAttributes.src.length <= 1250000 && /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+=*$/i.test(HTMLAttributes.src) ? HTMLAttributes.src : ""
    const width = Math.min(1200, Math.max(80, Number(HTMLAttributes.width) || 640))
    const align = ["left", "center", "right"].includes(HTMLAttributes.align) ? HTMLAttributes.align : "center"
    return ["img", { "data-report-image": "true", src, alt: String(HTMLAttributes.alt || "보고서 이미지").slice(0, 200), width, style: `display:block;max-width:100%;height:auto;width:${width}px;margin:${align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto"}` }]
  },
})

export function reportExtensions(collaborative = false) {
  return [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, undoRedo: collaborative ? false : undefined }), TextStyle, Color, TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: false } }), ReportImage, Format]
}
export function reportSchema() { return getSchema(reportExtensions()) }
