import type { Editor } from "@tiptap/core"
import { REPORT_FONTS } from "./document-report"

export function applyWholeReportFont(editor: Editor, font: string) {
  if (!editor.isEditable || !Object.hasOwn(REPORT_FONTS, font)) return false
  return editor.commands.command(({ tr, state }) => {
    const mark = state.schema.marks.textStyle
    state.doc.descendants((node, pos) => {
      if (node.isTextblock) tr.setNodeMarkup(pos, undefined, { ...node.attrs, documentFont: font })
      if (!node.isText) return
      const existing = node.marks.find(item => item.type === mark)
      tr.addMark(pos, pos + node.nodeSize, mark.create({ ...existing?.attrs, fontFamily: font }))
    })
    const marks = state.storedMarks || state.selection.$from.marks()
    tr.setStoredMarks([...marks.filter(item => item.type !== mark), mark.create({ ...marks.find(item => item.type === mark)?.attrs, fontFamily: font })])
    return true
  })
}

export type ReportEditScope = "selection" | "document"
export function applyReportTextStyle(editor: Editor, attrs: Record<string, unknown>, scope: ReportEditScope) {
  if (!editor.isEditable) return false
  if (scope === "selection") return editor.chain().focus(undefined, { scrollIntoView: false }).setMark("textStyle", attrs).run()
  if (typeof attrs.fontFamily === "string") applyWholeReportFont(editor, attrs.fontFamily)
  return editor.commands.command(({ tr, state }) => {
    const mark = state.schema.marks.textStyle
    state.doc.descendants((node, pos) => {
      if (node.isText) tr.addMark(pos, pos + node.nodeSize, mark.create({ ...node.marks.find(item => item.type === mark)?.attrs, ...attrs }))
    })
    return true
  })
}

export function applyReportBlockStyle(editor: Editor, attrs: Record<string, unknown>, scope: ReportEditScope) {
  if (!editor.isEditable) return false
  return editor.commands.command(({ tr, state }) => {
    const update = (node: typeof state.doc, pos: number) => { if (node.isTextblock) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }) }
    if (scope === "selection") for (const range of state.selection.ranges) state.doc.nodesBetween(range.$from.pos, range.$to.pos, update)
    else state.doc.descendants(update)
    return true
  })
}

export function applyReportCellStyle(editor: Editor, attribute: "backgroundColor" | "cellBorderColor", value: string, scope: ReportEditScope) {
  if (!editor.isEditable || !/^#[0-9a-f]{6}$/i.test(value)) return false
  if (scope === "selection") return editor.chain().focus(undefined, { scrollIntoView: false }).setCellAttribute(attribute, value).run()
  return editor.commands.command(({ tr, state }) => {
    state.doc.descendants((node, pos) => { if (["tableCell", "tableHeader"].includes(node.type.name)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, [attribute]: value }) })
    return true
  })
}
