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
