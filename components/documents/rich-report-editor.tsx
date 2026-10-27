"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/core"
import Collaboration from "@tiptap/extension-collaboration"
import type * as Y from "yjs"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, ImagePlus, Italic, List, ListOrdered, Redo2, RemoveFormatting, Table, Trash2, Underline, Undo2 } from "lucide-react"
import { DocumentReport, legacyReportContent, REPORT_FONTS, REPORT_TABLE_THEMES, RichReportNode } from "@/lib/document-report"
import { REPORT_LOGO } from "@/lib/document-report-logo"
import { reportExtensions } from "@/lib/document-rich-schema"
import { applyReportBlockStyle, applyReportCellStyle, applyReportTextStyle, applyWholeReportFont, ReportEditScope } from "@/lib/document-rich-commands"
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
const TABLE_THEME_SWATCHES: Record<string, string> = { classic: "#e4f0f6", corporate: "#1e3a5f", ocean: "#075985", teal: "#0f766e", forest: "#365314", rose: "#881337", striped: "#547987", minimal: "#f1f5f9", dark: "#173a4b" }

async function prepareReportImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) throw new Error("이미지 파일은 20MB 이하로 선택해주세요.")
  const bitmap = await createImageBitmap(file)
  try {
    let ratio = Math.min(1, 1600 / bitmap.width, 2000 / bitmap.height)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("이미지를 처리하지 못했습니다.")
    let blob: Blob | null = null
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio))
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", Math.max(0.58, 0.82 - attempt * 0.04)))
      if (!blob) throw new Error("이미지를 변환하지 못했습니다.")
      if (blob.size <= 900000) break
      ratio *= 0.82
    }
    if (!blob || blob.size > 900000) throw new Error("사진 용량을 줄이지 못했습니다. 다른 사진을 선택해주세요.")
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("이미지를 읽지 못했습니다."))
      reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."))
      reader.readAsDataURL(blob)
    })
  } finally { bitmap.close() }
}

export function RichReportEditor({ report, yDoc, editable, toolbarTarget, onChange, onSelection }: { report: DocumentReport; yDoc?: Y.Doc | null; editable: boolean; scale?: number; toolbarTarget?: HTMLElement | null; onChange: (report: DocumentReport) => void; onSelection: (selection: string) => void }) {
  const current = useRef(report)
  current.current = report
  const changed = useRef(onChange)
  changed.current = onChange
  const [tableOpen, setTableOpen] = useState(false)
  const [imageError, setImageError] = useState("")
  const imageInput = useRef<HTMLInputElement>(null)
  const [scope, setScope] = useState<ReportEditScope>("selection")
  const [cellMode, setCellMode] = useState(false)
  const cellModeRef = useRef(false)
  cellModeRef.current = cellMode
  const cellDrag = useRef<{ anchor: number; table: Element } | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const savedTextSelection = useRef<{ from: number; to: number } | null>(null)
  const lastPublished = useRef<RichReportNode | null>(null)
  const compositionFrame = useRef<number | null>(null)
  const shared = Boolean(yDoc?.getMap("report").get("richInitialized"))
  function publish(editor: Editor) {
    if (shared || editor.isDestroyed || editor.view.composing) return
    const richText = editor.getJSON() as RichReportNode
    lastPublished.current = richText
    const title = richText.content?.find(node => node.type === "heading" && node.attrs?.level === 1)?.content?.map(node => node.text || "").join("")
    changed.current({ ...current.current, richText, ...(title ? { fields: { ...current.current.fields, title: { ...current.current.fields?.title, text: title } } } : {}) })
  }
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    extensions: [...reportExtensions(shared), ...(shared && yDoc ? [Collaboration.configure({ document: yDoc, field: "rich-text" })] : [])],
    content: shared ? undefined : legacyReportContent(report),
    editable,
    editorProps: { attributes: { "aria-label": "보고서 본문", role: "textbox", "aria-multiline": "true", tabindex: "0", spellcheck: "false" },
      handleDOMEvents: {
        mousedown(view, event) {
          if (!cellModeRef.current || !view.editable || event.button !== 0) return false
          const cell = (event.target as Element).closest?.("td,th")
          if (!cell || !view.dom.contains(cell)) return false
          const resolved = view.state.doc.resolve(view.posAtDOM(cell, 0))
          for (let depth = resolved.depth; depth > 0; depth--) {
            if (!["tableCell", "tableHeader"].includes(resolved.node(depth).type.name)) continue
            const anchor = resolved.before(depth)
            cellDrag.current = { anchor, table: cell.closest("table")! }
            event.preventDefault()
            editorRef.current?.commands.setCellSelection({ anchorCell: anchor })
            return true
          }
          return false
        },
        mousemove(view, event) {
          const drag = cellDrag.current
          if (!drag || !cellModeRef.current || !event.buttons) return false
          const cell = (event.target as Element).closest?.("td,th")
          if (!cell || cell.closest("table") !== drag.table) return false
          const resolved = view.state.doc.resolve(view.posAtDOM(cell, 0))
          for (let depth = resolved.depth; depth > 0; depth--) {
            if (!["tableCell", "tableHeader"].includes(resolved.node(depth).type.name)) continue
            event.preventDefault()
            editorRef.current?.commands.setCellSelection({ anchorCell: drag.anchor, headCell: resolved.before(depth) })
            return true
          }
          return false
        },
      },
      handleClickOn(view, _pos, node, nodePos) {
        if (node.type.name !== "reportImage" || !view.editable) return false
        editorRef.current?.commands.setNodeSelection(nodePos)
        editorRef.current?.view.focus()
        return true
      },
    },
    onUpdate({ editor }) { publish(editor) },
    onSelectionUpdate({ editor }) { onSelection(`본문 ${editor.state.selection.from}`) },
  }, [yDoc, shared])
  editorRef.current = editor
  useEffect(() => { if (editor && !editor.isDestroyed) editor.setEditable(editable) }, [editor, editable])
  useEffect(() => {
    const release = () => { cellDrag.current = null }
    document.addEventListener("mouseup", release)
    return () => document.removeEventListener("mouseup", release)
  }, [])
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // The editor can be destroyed before React runs this effect's cleanup.
    const editorDOM = editor.view.dom
    const endComposition = () => {
      if (compositionFrame.current !== null) cancelAnimationFrame(compositionFrame.current)
      compositionFrame.current = requestAnimationFrame(() => { compositionFrame.current = null; publish(editor) })
    }
    editorDOM.addEventListener("compositionend", endComposition)
    return () => { editorDOM.removeEventListener("compositionend", endComposition); if (compositionFrame.current !== null) { cancelAnimationFrame(compositionFrame.current); compositionFrame.current = null } }
  }, [editor, shared])
  // Only genuinely external content may replace the document; local echoes must preserve its DOM and selection.
  useEffect(() => {
    if (!editor || editor.isDestroyed || shared || editor.view.composing || report.richText === lastPublished.current) return
    const content = legacyReportContent(report)
    const next = editor.schema.nodeFromJSON(content)
    if (!editor.state.doc.eq(next)) editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, shared, report])
  const state = useEditorState({ editor, selector: ({ editor }) => editor && !editor.isDestroyed ? {
    kind: editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph").reportKind || (editor.isActive("heading", { level: 1 }) ? "title" : editor.isActive("heading", { level: 2 }) ? "heading" : editor.isActive("heading", { level: 3 }) ? "subheading" : "body"),
    text: editor.getAttributes("textStyle"), block: editor.getAttributes(editor.isActive("heading") ? "heading" : "paragraph"), tableStyle: editor.getAttributes("table"), cellStyle: editor.getAttributes(editor.isActive("tableHeader") ? "tableHeader" : "tableCell"),
    documentFont: editor.state.doc.firstChild?.attrs.documentFont || "gothic",
    imageSelected: editor.state.selection.constructor.name === "NodeSelection" && (editor.state.selection as unknown as { node?: { type?: { name?: string } } }).node?.type?.name === "reportImage",
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"),
    bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), table: editor.isActive("table"), undo: editor.can().undo(), redo: editor.can().redo(),
  } : null })
  function preset(key: string) {
    if (!editor) return
    const selected = PRESETS.find(item => item.key === key)
    if (!selected || !editable) return
    const selection = editor.state.selection
    const saved = savedTextSelection.current
    if (saved && selection.empty && saved.from < saved.to && saved.to <= editor.state.doc.content.size) {
      editor.commands.setTextSelection(saved)
    }
    savedTextSelection.current = null
    const font = state?.documentFont || "gothic"
    // A heading style belongs to its paragraph, while inline formatting remains selection-based.
    const { from, to } = editor.state.selection
    const start = editor.state.doc.resolve(from)
    if (from < to && start.parent.isTextblock && start.parentOffset === start.parent.content.size) {
      let nextStart: number | null = null
      editor.state.doc.nodesBetween(from, to, (node, pos) => { if (nextStart === null && node.isTextblock && pos > from) nextStart = pos + 1 })
      if (nextStart !== null) editor.commands.setTextSelection({ from: nextStart, to })
    }
    let chain = editor.chain().focus(undefined, { scrollIntoView: false })
    if ((selected.level || key === "subtitle" || key === "meta") && (editor.isActive("bulletList") || editor.isActive("orderedList"))) chain = chain.liftListItem("listItem")
    chain = selected.level ? chain.setHeading({ level: selected.level as 1 | 2 | 3 }) : chain.setParagraph()
    chain.updateAttributes(selected.level ? "heading" : "paragraph", { reportKind: key, lineHeight: key === "title" ? 1.45 : 1.75, spaceAfter: key === "title" ? 24 : 8, pageBreak: false }).setTextAlign(selected.align).run()
    editor.commands.command(({ tr, state }) => {
      const marks = [state.schema.marks.textStyle.create({ fontSize: selected.size, fontFamily: font, letterSpacing: 0, color: key === "subtitle" || key === "meta" ? "#52636b" : "#172b35" }), ...(["title", "heading", "subheading"].includes(key) ? [state.schema.marks.bold.create()] : [])]
      for (const range of tr.selection.ranges) state.doc.nodesBetween(range.$from.pos, range.$to.pos, (node, pos) => {
        if (!node.isTextblock) return
        tr.removeMark(pos + 1, pos + node.nodeSize - 1)
        tr.addMark(pos + 1, pos + node.nodeSize - 1, state.schema.marks.textStyle.create({ fontSize: selected.size, fontFamily: font, letterSpacing: 0, color: key === "subtitle" || key === "meta" ? "#52636b" : "#172b35" }))
        if (["title", "heading", "subheading"].includes(key)) tr.addMark(pos + 1, pos + node.nodeSize - 1, state.schema.marks.bold.create())
      })
      if (tr.selection.empty) tr.setStoredMarks(marks)
      return true
    })
    editor.commands.focus(undefined, { scrollIntoView: false })
  }
  function inline(attrs: Record<string, any>) { if (editor) applyReportTextStyle(editor, attrs, scope) }
  function applyTableTheme(theme: string) {
    if (!editor) return
    editor.commands.command(({ state, tr }) => {
      let tableDepth = state.selection.$from.depth
      while (tableDepth > 0 && state.selection.$from.node(tableDepth).type.name !== "table") tableDepth--
      if (!tableDepth) return false
      const table = state.selection.$from.node(tableDepth)
      const tablePos = state.selection.$from.before(tableDepth)
      table.descendants((node, offset) => {
        if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
          tr.setNodeMarkup(tablePos + 1 + offset, undefined, { ...node.attrs, backgroundColor: null, cellBorderColor: null })
        }
      })
      tr.setNodeMarkup(tablePos, undefined, { ...table.attrs, tableTheme: theme, headerColor: null, borderColor: null })
      return true
    })
  }
  async function addImage(file?: File) {
    if (!file || !editor || editor.isDestroyed) return
    try {
      const src = await prepareReportImage(file)
      if (editor.isDestroyed) return
      editor.chain().focus(undefined, { scrollIntoView: false }).insertContent({ type: "reportImage", attrs: { src, alt: file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "보고서 이미지", width: 640, align: "center" } }).run()
      setImageError("")
    } catch (error) { setImageError(error instanceof Error ? error.message : "이미지를 첨부하지 못했습니다.") }
    if (imageInput.current) imageInput.current.value = ""
  }
  function block(attrs: Record<string, any>) { if (editor) applyReportBlockStyle(editor, attrs, scope) }
  function toggleMark(mark: "bold" | "italic" | "underline") {
    if (!editor || !editable) return
    if (scope === "selection") { editor.chain().focus(undefined, { scrollIntoView: false }).toggleMark(mark).run(); return }
    const enabled = !editor.isActive(mark)
    editor.commands.command(({ tr, state }) => {
      const type = state.schema.marks[mark]
      state.doc.descendants((node, pos) => { if (node.isText) { if (enabled) tr.addMark(pos, pos + node.nodeSize, type.create()); else tr.removeMark(pos, pos + node.nodeSize, type) } })
      return true
    })
  }
  function button(label: string, Icon: typeof Bold, action: (editor: Editor) => void, active = false, disabled = false) {
    return <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={!editor || !editable || disabled} className={`${TOOL} ${active ? "!bg-blue-50 !text-blue-700" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => editor && action(editor)}><Icon size={16} /></button>
  }
  const toolbar = <fieldset disabled={!editable || !editor} className={`flex flex-wrap items-center gap-2 bg-white disabled:opacity-60 ${toolbarTarget ? "border-t border-slate-200 pt-4" : "sticky top-2 z-30 mb-4 rounded-md border border-slate-200 p-2 shadow-md"}`} aria-label="선택한 텍스트 서식">
      <h2 className="w-full text-sm font-bold text-slate-800">서식 편집</h2>
      <div role="group" aria-label="서식 적용 범위" className="grid w-full grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">{[{ value: "selection", label: "선택 영역" }, { value: "document", label: "문서 전체" }].map(item => <button key={item.value} type="button" aria-pressed={scope === item.value} onMouseDown={event => event.preventDefault()} onClick={() => setScope(item.value as ReportEditScope)} className={`rounded px-2 py-2 text-xs font-semibold ${scope === item.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{item.label}</button>)}</div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">문단 서식<select disabled={scope === "document"} aria-label="문단 서식" title="선택한 문단에 적용할 서식" className={`${INPUT} w-28 font-semibold disabled:opacity-40`} value={state?.kind || "body"} onMouseDown={() => { const selection = editor?.state.selection; savedTextSelection.current = selection && !selection.empty ? { from: selection.from, to: selection.to } : null }} onChange={event => preset(event.target.value)}>{PRESETS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      <select aria-label="선택 글꼴" className={`${INPUT} w-28`} value={state?.text.fontFamily || "gothic"} onChange={event => inline({ fontFamily: event.target.value })}>{Object.entries(REPORT_FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}</select>
      <NumberControl label="선택 글자 크기" className={`${INPUT} w-16`} min={7} max={48} step={0.5} value={Number(state?.text.fontSize) || PRESETS.find(item => item.key === state?.kind)?.size || 10.5} onCommit={value => inline({ fontSize: value })} />
      {button("굵게", Bold, () => toggleMark("bold"), state?.bold)}
      {button("기울임", Italic, () => toggleMark("italic"), state?.italic)}
      {button("밑줄", Underline, () => toggleMark("underline"), state?.underline)}
      <input aria-label="선택 글자색" title="글자색" type="color" className="h-7 w-7 cursor-pointer border-0 bg-white p-0" value={state?.text.color || "#172b35"} onChange={event => inline({ color: event.target.value })} />
      <span className="mx-1 h-5 w-px bg-slate-200" />
      {([{ value: "left", label: "왼쪽 정렬", Icon: AlignLeft }, { value: "center", label: "가운데 정렬", Icon: AlignCenter }, { value: "right", label: "오른쪽 정렬", Icon: AlignRight }, { value: "justify", label: "양쪽 정렬", Icon: AlignJustify }] as const).map(({ value, label, Icon }) => <span key={value}>{button(label, Icon, () => block({ textAlign: value }), state?.block.textAlign === value)}</span>)}
      {button("글머리 목록", List, e => e.chain().focus(undefined, { scrollIntoView: false }).toggleBulletList().run(), state?.bullet)}
      {button("번호 목록", ListOrdered, e => e.chain().focus(undefined, { scrollIntoView: false }).toggleOrderedList().run(), state?.ordered)}
      <button type="button" className={TOOL} aria-label="사진 첨부" title="사진 첨부" disabled={!editor || !editable} onMouseDown={event => event.preventDefault()} onClick={() => imageInput.current?.click()}><ImagePlus size={16} /></button>
      {state?.imageSelected && <button type="button" className={`${TOOL} !text-rose-600 hover:!bg-rose-50`} aria-label="선택 사진 삭제" title="선택 사진 삭제" onMouseDown={event => event.preventDefault()} onClick={() => editor?.chain().focus(undefined, { scrollIntoView: false }).deleteSelection().run()}><Trash2 size={16} /></button>}
      <input ref={imageInput} type="file" accept="image/*" className="sr-only" aria-label="첨부할 사진" onChange={event => { void addImage(event.target.files?.[0]) }} />
      {imageError && <span role="status" className="w-full text-xs text-rose-600">{imageError}</span>}
      <button type="button" className={TOOL} aria-label="표 편집" title="표 편집" aria-expanded={tableOpen} onMouseDown={event => event.preventDefault()} onClick={() => setTableOpen(value => !value)}><Table size={16} /></button>
      {button("서식 지우기", RemoveFormatting, e => {
        if (scope === "selection") e.chain().focus(undefined, { scrollIntoView: false }).unsetAllMarks().run()
        else e.commands.command(({ tr, state }) => { tr.removeMark(0, state.doc.content.size); return true })
      })}
      {button("본문 실행 취소", Undo2, e => e.chain().focus(undefined, { scrollIntoView: false }).undo().run(), false, !state?.undo)}
      {button("본문 다시 실행", Redo2, e => e.chain().focus(undefined, { scrollIntoView: false }).redo().run(), false, !state?.redo)}
      <div className="flex w-full flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
        <label className="flex items-center gap-2">문서 전체 글꼴<select aria-label="문서 전체 글꼴" className={INPUT} value={state?.documentFont || "gothic"} onChange={event => { if (editor) applyWholeReportFont(editor, event.target.value) }}>{Object.entries(REPORT_FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}</select></label>
        <label className="flex items-center gap-2">자간<NumberControl label="선택 자간" className={`${INPUT} w-16`} min={0} max={8} step={0.1} value={Number(state?.text.letterSpacing) || 0} onCommit={value => inline({ letterSpacing: value })} /></label>
        <label className="flex items-center gap-2">행간<select aria-label="선택 행간" className={INPUT} value={state?.block.lineHeight || 1.75} onChange={event => block({ lineHeight: Number(event.target.value) })}>{[1, 1.25, 1.45, 1.5, 1.6, 1.75, 2, 2.5, 3].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(state?.block.pageBreak)} onChange={event => block({ pageBreak: event.target.checked })} />새 페이지</label>
      </div>
      {tableOpen && <div className="flex w-full flex-wrap gap-2 border-t border-slate-100 pt-2">{[{ label: "표 삽입", action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: state?.table }, { label: "행 추가", action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).addRowAfter().run(), disabled: !state?.table }, { label: "열 추가", action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).addColumnAfter().run(), disabled: !state?.table }, { label: "행 삭제", action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).deleteRow().run(), disabled: !state?.table }, { label: "열 삭제", action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).deleteColumn().run(), disabled: !state?.table }, { label: "표 삭제", action: () => editor?.chain().focus(undefined, { scrollIntoView: false }).deleteTable().run(), disabled: !state?.table }].map(item => <button key={item.label} type="button" disabled={item.disabled} className={`${INPUT} disabled:opacity-30`} onMouseDown={event => event.preventDefault()} onClick={item.action}>{item.label}</button>)}</div>}
      {tableOpen && <fieldset disabled={!state?.table} className="flex w-full flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-500 disabled:opacity-40" aria-label="표 디자인">
        <div role="group" aria-label="표 선택 방식" className="grid w-full grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">{[{ value: false, label: "글자 선택" }, { value: true, label: "셀 선택" }].map(item => <button key={item.label} type="button" aria-pressed={cellMode === item.value} onMouseDown={event => event.preventDefault()} onClick={() => { cellDrag.current = null; setCellMode(item.value) }} className={`rounded px-2 py-2 text-xs font-semibold ${cellMode === item.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>{item.label}</button>)}</div>
        <label className="flex items-center gap-2">셀 배경<input type="color" aria-label="선택 셀 배경색" className="h-7 w-7 cursor-pointer border-0 bg-white p-0" value={state?.cellStyle.backgroundColor || "#ffffff"} onChange={event => { if (editor) applyReportCellStyle(editor, "backgroundColor", event.target.value, scope) }} /></label>
        <label className="flex items-center gap-2">셀 테두리<input type="color" aria-label="선택 셀 테두리색" className="h-7 w-7 cursor-pointer border-0 bg-white p-0" value={state?.cellStyle.cellBorderColor || "#b5c6cd"} onChange={event => { if (editor) applyReportCellStyle(editor, "cellBorderColor", event.target.value, scope) }} /></label>
        <div role="group" aria-label="표 전체 디자인" className="grid w-full grid-cols-3 gap-2 sm:grid-cols-5">
          {REPORT_TABLE_THEMES.map(theme => <button key={theme.value} type="button" aria-label={`${theme.label} 표 디자인 적용`} aria-pressed={(state?.tableStyle.tableTheme || "classic") === theme.value} title={theme.label} className={`min-w-0 rounded border p-1 text-[10px] font-semibold ${state?.tableStyle.tableTheme === theme.value ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`} onMouseDown={event => event.preventDefault()} onClick={() => applyTableTheme(theme.value)}>
            <span className="mb-1 grid overflow-hidden rounded-sm border border-slate-200"><span className="block h-2" style={{ backgroundColor: TABLE_THEME_SWATCHES[theme.value] }} /><span className="block h-1.5 bg-slate-100" /><span className="block h-1.5 bg-white" /></span>{theme.label}
          </button>)}
        </div>
        <label className="flex items-center gap-2">셀 간격<select aria-label="표 셀 간격" className={INPUT} value={state?.tableStyle.tableDensity || "standard"} onChange={event => editor?.chain().focus(undefined, { scrollIntoView: false }).updateAttributes("table", { tableDensity: event.target.value }).run()}><option value="compact">좁게</option><option value="standard">보통</option><option value="airy">넓게</option></select></label>
        <label className="flex items-center gap-2">헤더색<input type="color" aria-label="표 헤더색" className="h-7 w-7 cursor-pointer border-0 bg-white p-0" value={state?.tableStyle.headerColor || TABLE_THEME_SWATCHES[state?.tableStyle.tableTheme || "classic"] || "#e4f0f6"} onChange={event => editor?.chain().focus(undefined, { scrollIntoView: false }).updateAttributes("table", { headerColor: event.target.value }).run()} /></label>
        <label className="flex items-center gap-2">테두리색<input type="color" aria-label="표 테두리색" className="h-7 w-7 cursor-pointer border-0 bg-white p-0" value={state?.tableStyle.borderColor || "#b5c6cd"} onChange={event => editor?.chain().focus(undefined, { scrollIntoView: false }).updateAttributes("table", { borderColor: event.target.value }).run()} /></label>
      </fieldset>}
    </fieldset>
  return <div className={`min-w-0 ${cellMode ? "report-cell-selection" : ""}`}>
    {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar}
    <div className="report-editor-paper mx-auto w-full max-w-[794px] bg-white shadow-sm" style={{ minHeight: 1123 }} onMouseDown={event => {
      if (!editor || editor.isDestroyed || !editable || event.button !== 0 || !(event.target instanceof Element) || event.target.closest(".tiptap,.report-brand")) return
      try {
        const bounds = editor.view.dom.getBoundingClientRect()
        const position = editor.view.posAtCoords({ left: Math.max(bounds.left + 1, Math.min(bounds.right - 1, event.clientX)), top: Math.max(bounds.top + 1, Math.min(bounds.bottom - 1, event.clientY)) })
        if (position) { event.preventDefault(); editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(position.pos).run() }
      } catch { /* Keep the editor usable if it is being replaced during a click. */ }
    }} onClick={event => {
      if (!editor || editor.isDestroyed || !editable || !(event.target instanceof Element) || !event.target.closest(".tiptap")) return
      const selection = editor.state.selection
      if (!selection.empty) return
      try {
        const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (!position) return
        if (selection.from !== position.pos) editor.commands.setTextSelection(position.pos)
        editor.view.focus()
      } catch { /* The editor may be switching documents. */ }
    }}>
      <article className="company-report" style={{ padding: `${report.page?.margin ?? 18}mm`, fontFamily: REPORT_FONTS[(state?.documentFont || "gothic") as keyof typeof REPORT_FONTS]?.css }}>
        <div className="report-brand"><img className="report-logo" width={report.page?.logoWidth ?? 145} src={REPORT_LOGO} alt="INFOMAX" /></div>
        <EditorContent editor={editor} />
      </article>
    </div>
  </div>
}
