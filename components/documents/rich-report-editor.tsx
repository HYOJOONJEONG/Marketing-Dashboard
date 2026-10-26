"use client"

import { useEffect, useRef, useState } from "react"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import Collaboration from "@tiptap/extension-collaboration"
import type * as Y from "yjs"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Italic, List, ListOrdered, Redo2, RemoveFormatting, Table, Underline, Undo2 } from "lucide-react"
import { DocumentReport, legacyReportContent, REPORT_FONTS, RichReportNode } from "@/lib/document-report"
import { REPORT_LOGO } from "@/lib/document-report-logo"
import { reportExtensions } from "@/lib/document-rich-schema"
import { NumberControl } from "./number-control"

const TOOL = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 disabled:opacity-30"
const INPUT = "h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700"
const PRESETS = [
  { key: "title", label: "제목", level: 1, size: 23, align: "center" },
  { key: "subtitle", label: "부제목", level: 0, size: 13, align: "center" },
  { key: "heading", label: "큰 제목", level: 2, size: 15, align: "left" },
  { key: "subheading", label: "소제목", level: 3, size: 11.5, align: "left" },
  { key: "body", label: "본문", level: 0, size: 10.5, align: "left" },
  { key: "meta", label: "작성 정보", level: 0, size: 9, align: "right" },
]

export function RichReportEditor({ report, yDoc, editable, scale, onChange, onSelection }: { report: DocumentReport; yDoc?: Y.Doc | null; editable: boolean; scale: number; onChange: (report: DocumentReport) => void; onSelection: (selection: string) => void }) {
  const current = useRef(report)
  current.current = report
  const changed = useRef(onChange)
  changed.current = onChange
  const [tableOpen, setTableOpen] = useState(false)
  const shared = Boolean(yDoc?.getMap("report").get("richInitialized"))
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...reportExtensions(shared), ...(shared && yDoc ? [Collaboration.configure({ document: yDoc, field: "rich-text" })] : [])],
    content: shared ? undefined : legacyReportContent(report),
    editable,
    editorProps: { attributes: { "aria-label": "보고서 본문", role: "textbox", "aria-multiline": "true", spellcheck: "false" } },
    onUpdate({ editor }) {
      if (!shared) {
        const richText = editor.getJSON() as RichReportNode
        const title = richText.content?.find(node => node.type === "heading" && node.attrs?.level === 1)?.content?.map(node => node.text || "").join("")
        changed.current({ ...current.current, richText, ...(title ? { fields: { ...current.current.fields, title: { ...current.current.fields?.title, text: title } } } : {}) })
      }
    },
    onSelectionUpdate({ editor }) { onSelection(`본문 ${editor.state.selection.from}`) },
  }, [yDoc, shared])
  useEffect(() => { editor?.setEditable(editable) }, [editor, editable])
  // External source conversion and local undo replace content; typing never resets selection.
  useEffect(() => {
    if (!editor || shared) return
    const content = legacyReportContent(report)
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, shared, report])
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? {
    kind: editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph").reportKind || (editor.isActive("heading", { level: 1 }) ? "title" : editor.isActive("heading", { level: 2 }) ? "heading" : editor.isActive("heading", { level: 3 }) ? "subheading" : "body"),
    text: editor.getAttributes("textStyle"), block: editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph"),
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
    bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), table: editor.isActive("table"), undo: editor.can().undo(), redo: editor.can().redo(),
  } : null })
  function preset(key: string) {
    if (!editor) return
    const selected = PRESETS.find(item => item.key === key)
    if (!selected || !editable) return
    // A heading style belongs to its paragraph, while inline formatting remains selection-based.
    const { from, to } = editor.state.selection
    const start = editor.state.doc.resolve(from)
    if (from < to && start.parent.isTextblock && start.parentOffset === start.parent.content.size) {
      let nextStart: number | null = null
      editor.state.doc.nodesBetween(from, to, (node, pos) => { if (nextStart === null && node.isTextblock && pos > from) nextStart = pos + 1 })
      if (nextStart !== null) editor.commands.setTextSelection({ from: nextStart, to })
    }
    let chain = editor.chain().focus()
    if ((selected.level || key === "subtitle" || key === "meta") && (editor.isActive("bulletList") || editor.isActive("orderedList"))) chain = chain.liftListItem("listItem")
    chain = selected.level ? chain.setHeading({ level: selected.level as 1 | 2 | 3 }) : chain.setParagraph()
    chain.updateAttributes(selected.level ? "heading" : "paragraph", { reportKind: key, lineHeight: key === "title" ? 1.45 : 1.75, spaceAfter: key === "title" ? 24 : 8, pageBreak: false }).setTextAlign(selected.align).run()
    editor.commands.command(({ tr, state }) => {
      const marks = [state.schema.marks.textStyle.create({ fontSize: selected.size, fontFamily: "gothic", letterSpacing: 0, color: key === "subtitle" || key === "meta" ? "#52636b" : "#172b35" }), ...(["title", "heading", "subheading"].includes(key) ? [state.schema.marks.bold.create()] : [])]
      state.doc.nodesBetween(tr.selection.from, tr.selection.to, (node, pos) => {
        if (!node.isTextblock) return
        tr.removeMark(pos + 1, pos + node.nodeSize - 1)
        tr.addMark(pos + 1, pos + node.nodeSize - 1, state.schema.marks.textStyle.create({ fontSize: selected.size, fontFamily: "gothic", letterSpacing: 0, color: key === "subtitle" || key === "meta" ? "#52636b" : "#172b35" }))
        if (["title", "heading", "subheading"].includes(key)) tr.addMark(pos + 1, pos + node.nodeSize - 1, state.schema.marks.bold.create())
      })
      if (tr.selection.empty) tr.setStoredMarks(marks)
      return true
    })
    editor.commands.focus()
  }
  function inline(attrs: Record<string, any>) { editor?.chain().focus().setMark("textStyle", attrs).run() }
  function block(attrs: Record<string, any>) { if (editor) editor.chain().focus().updateAttributes(editor.isActive("heading") ? "heading" : "paragraph", attrs).run() }
  function button(label: string, Icon: typeof Bold, action: (editor: Editor) => void, active = false, disabled = false) {
    return <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={!editor || !editable || disabled} className={`${TOOL} ${active ? "!bg-blue-50 !text-blue-700" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => editor && action(editor)}><Icon size={16} /></button>
  }
  return <div className="min-w-0">
    <fieldset disabled={!editable || !editor} className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-white p-2 shadow-sm disabled:opacity-60" aria-label="선택한 텍스트 서식">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">문단 서식<select aria-label="문단 서식" title="선택한 문단에 적용할 서식" className={`${INPUT} w-28 font-semibold`} value={state?.kind || "body"} onChange={event => preset(event.target.value)}>{PRESETS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <select aria-label="선택 글꼴" className={`${INPUT} w-28`} value={state?.text.fontFamily || "gothic"} onChange={event => inline({ fontFamily: event.target.value })}>{Object.entries(REPORT_FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}</select>
      <NumberControl label="선택 글자 크기" className={`${INPUT} w-16`} min={7} max={48} step={0.5} value={Number(state?.text.fontSize) || PRESETS.find(item => item.key === state?.kind)?.size || 10.5} onCommit={value => inline({ fontSize: value })} />
      {button("굵게", Bold, e => e.chain().focus().toggleBold().run(), state?.bold)}
      {button("기울임", Italic, e => e.chain().focus().toggleItalic().run(), state?.italic)}
      {button("밑줄", Underline, e => e.chain().focus().toggleUnderline().run(), state?.underline)}
      <input aria-label="선택 글자색" title="글자색" type="color" className="h-7 w-7 cursor-pointer border-0 bg-white p-0" value={state?.text.color || "#172b35"} onChange={event => editor?.chain().focus().setColor(event.target.value).run()} />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      {([{ value: "left", label: "왼쪽 정렬", Icon: AlignLeft }, { value: "center", label: "가운데 정렬", Icon: AlignCenter }, { value: "right", label: "오른쪽 정렬", Icon: AlignRight }, { value: "justify", label: "양쪽 정렬", Icon: AlignJustify }] as const).map(({ value, label, Icon }) => <span key={value}>{button(label, Icon, e => e.chain().focus().setTextAlign(value).run(), state?.block.textAlign === value)}</span>)}
      {button("글머리 목록", List, e => e.chain().focus().toggleBulletList().run(), state?.bullet)}
      {button("번호 목록", ListOrdered, e => e.chain().focus().toggleOrderedList().run(), state?.ordered)}
      <button type="button" className={TOOL} aria-label="표 편집" title="표 편집" aria-expanded={tableOpen} onMouseDown={event => event.preventDefault()} onClick={() => setTableOpen(value => !value)}><Table size={16} /></button>
      {button("서식 지우기", RemoveFormatting, e => e.chain().focus().unsetAllMarks().run())}
      {button("본문 실행 취소", Undo2, e => e.chain().focus().undo().run(), false, !state?.undo)}
      {button("본문 다시 실행", Redo2, e => e.chain().focus().redo().run(), false, !state?.redo)}
      <div className="flex w-full flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <label className="flex items-center gap-2">자간<NumberControl label="선택 자간" className={`${INPUT} w-16`} min={0} max={8} step={0.1} value={Number(state?.text.letterSpacing) || 0} onCommit={value => inline({ letterSpacing: value })} /></label>
        <label className="flex items-center gap-2">행간<select aria-label="선택 행간" className={INPUT} value={state?.block.lineHeight || 1.75} onChange={event => block({ lineHeight: Number(event.target.value) })}>{[1, 1.25, 1.45, 1.5, 1.6, 1.75, 2, 2.5, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(state?.block.pageBreak)} onChange={event => block({ pageBreak: event.target.checked })} />새 페이지</label>
      </div>
      {tableOpen && <div className="flex w-full flex-wrap gap-2 border-t border-slate-100 pt-2">{[{ label: "표 삽입", action: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: state?.table }, { label: "행 추가", action: () => editor?.chain().focus().addRowAfter().run(), disabled: !state?.table }, { label: "열 추가", action: () => editor?.chain().focus().addColumnAfter().run(), disabled: !state?.table }, { label: "행 삭제", action: () => editor?.chain().focus().deleteRow().run(), disabled: !state?.table }, { label: "열 삭제", action: () => editor?.chain().focus().deleteColumn().run(), disabled: !state?.table }, { label: "표 삭제", action: () => editor?.chain().focus().deleteTable().run(), disabled: !state?.table }].map(item => <button key={item.label} type="button" disabled={item.disabled} className={`${INPUT} disabled:opacity-30`} onMouseDown={event => event.preventDefault()} onClick={item.action}>{item.label}</button>)}</div>}
    </fieldset>
    <div className="report-editor-paper mx-auto bg-white shadow-sm" style={{ width: 794, minHeight: 1123, zoom: scale }}>
      <article className="company-report" style={{ padding: `${report.page?.margin ?? 18}mm` }}>
        <div className="report-brand"><img className="report-logo" width={report.page?.logoWidth ?? 145} src={REPORT_LOGO} alt="INFOMAX" /></div>
        <EditorContent editor={editor} />
      </article>
    </div>
  </div>
}
