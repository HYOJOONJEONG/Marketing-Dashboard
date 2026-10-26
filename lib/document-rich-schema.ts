import { Extension, getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { TextStyle } from "@tiptap/extension-text-style"
import Color from "@tiptap/extension-color"
import TextAlign from "@tiptap/extension-text-align"
import { TableKit } from "@tiptap/extension-table"
import { REPORT_FONTS } from "./document-report"

const Format = Extension.create({
  name: "reportFormat",
  addGlobalAttributes() {
    return [
      { types: ["paragraph", "heading"], attributes: {
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

export function reportExtensions(collaborative = false) {
  return [StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, undoRedo: collaborative ? false : undefined }), TextStyle, Color, TextAlign.configure({ types: ["heading", "paragraph"] }), TableKit.configure({ table: { resizable: false } }), Format]
}
export function reportSchema() { return getSchema(reportExtensions()) }
