"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowRight, Bold, Copy, Download, FileText, Italic, PanelLeftClose, PanelLeftOpen, Printer, Redo2, RotateCcw, Underline, Undo2 } from "lucide-react"
import { DocumentReport, ReportStyle, defaultFieldStyle, fieldText, formatDocumentReport, reportFields, reportHtml, reportPlainText, REPORT_CSS, REPORT_FONTS } from "@/lib/document-report"

const INPUT = "h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
const TOOL = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30"

export function DocumentWorkspace({ author, userId, department }: { author: string; userId: string; department?: string }) {
  const [source, setSource] = useState("")
  const [title, setTitle] = useState("업무 보고서")
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()))
  const [writer, setWriter] = useState(department || author)
  const [report, setReport] = useState<DocumentReport | null>(null)
  const [selected, setSelected] = useState("title")
  const [message, setMessage] = useState("")
  const [ready, setReady] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(true)
  const [undo, setUndo] = useState<DocumentReport[]>([])
  const [redo, setRedo] = useState<DocumentReport[]>([])
  const [scale, setScale] = useState(1)
  const stageRef = useRef<HTMLDivElement>(null)
  const sourceChanged = useRef(false)
  const draftKey = `document-report-draft:${userId}`

  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored)
        if (typeof draft.source === "string") setSource(draft.source)
        if (typeof draft.title === "string") setTitle(draft.title)
        if (typeof draft.date === "string") setDate(draft.date)
        if (typeof draft.writer === "string") setWriter(draft.writer)
        if (draft.report && typeof draft.report.title === "string" && typeof draft.report.author === "string" && typeof draft.report.date === "string" && Array.isArray(draft.report.sections) && draft.report.sections.every((s: any) => typeof s.heading === "string" && typeof s.content === "string")) {
          setReport(draft.report)
          setSourceOpen(false)
        }
      }
    } catch { setMessage("임시 문서를 불러오지 못했습니다.") }
    setReady(true)
  }, [draftKey])

  useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(draftKey, JSON.stringify({ source, title, date, writer, report })) }
    catch { setMessage("임시 보관 공간이 부족합니다. 파일로 내려받아 주세요.") }
  }, [source, title, date, writer, report, draftKey, ready])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, Math.max(0.2, entry.contentRect.width / 794))))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!sourceChanged.current || !ready || !source.trim()) return
    const timer = setTimeout(() => {
      // Existing edits are only replaced by the explicit apply action.
      if (!report?.fields || !Object.keys(report.fields).length) {
        sourceChanged.current = false
        setReport(formatDocumentReport(source, { title, date, author: writer }))
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [source, title, date, writer, ready, report])

  const fields = useMemo(() => report ? reportFields(report) : [], [report])
  const field = fields.find(item => item.key === selected)
  const style: ReportStyle = { ...defaultFieldStyle(field?.kind || "body"), ...(selected.includes(".r0.") ? { bold: true } : {}), ...report?.fields?.[selected]?.style }

  function commit(next: DocumentReport) {
    if (report) setUndo(items => [...items.slice(-39), report])
    setRedo([])
    setReport(next)
    setMessage("이 브라우저에 임시 보관됨")
  }
  function changeStyle(patch: ReportStyle) {
    if (!report || !field) return
    commit({ ...report, fields: { ...report.fields, [selected]: { ...report.fields?.[selected], style: { ...report.fields?.[selected]?.style, ...patch } } } })
  }
  function setFieldText(value: string) {
    if (!report || !field) return
    commit({ ...report, fields: { ...report.fields, [selected]: { ...report.fields?.[selected], text: value } } })
  }
  function travel(direction: "undo" | "redo") {
    if (!report) return
    const stack = direction === "undo" ? undo : redo
    const previous = stack.at(-1)
    if (!previous) return
    if (direction === "undo") { setUndo(stack.slice(0, -1)); setRedo(items => [...items, report]) }
    else { setRedo(stack.slice(0, -1)); setUndo(items => [...items, report]) }
    setReport(previous)
  }
  function applySource() {
    if (!source.trim()) return
    sourceChanged.current = false
    commit(formatDocumentReport(source, { title: title.trim() || "업무 보고서", date, author: writer.trim() }))
    setSelected("title")
    setSourceOpen(false)
    setMessage("공통 보고서 양식을 적용했습니다.")
  }
  function download() {
    if (!report) return
    const blob = new Blob(["\ufeff", reportHtml(report)], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${fieldText(report, "title", report.title).replace(/[\\/:*?"<>|]/g, "_") || "보고서"}_${report.date}.html`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function printReport() {
    if (!report) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) { setMessage("인쇄 창을 열 수 없습니다. 팝업 허용 후 다시 시도해주세요."); return }
    printWindow.opener = null
    printWindow.document.open()
    printWindow.document.write(reportHtml(report))
    printWindow.document.close()
    await Promise.all([printWindow.document.fonts.ready, ...Array.from(printWindow.document.images).map(image => image.decode().catch(() => undefined))])
    if (!printWindow.closed) { printWindow.focus(); printWindow.print() }
  }
  async function copy() {
    if (!report) return
    try { await navigator.clipboard.writeText(reportPlainText(report)); setMessage("수정된 보고서 내용을 복사했습니다.") }
    catch { setMessage("복사하지 못했습니다. 다운로드를 이용해주세요.") }
  }
  function selectField(target: EventTarget) {
    const element = target instanceof Element ? target.closest<HTMLElement>("[data-report-field]") : null
    if (element?.dataset.reportField) setSelected(element.dataset.reportField)
  }

  return <div className="document-workspace min-w-0">
    <style>{REPORT_CSS}</style>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div className="flex items-center gap-2">
        <button type="button" className={TOOL} onClick={() => setSourceOpen(value => !value)} title="원문 입력" aria-label="원문 입력" aria-expanded={sourceOpen}>{sourceOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}</button>
        <span className="text-sm font-bold text-slate-800">보고서 편집</span>
        <span className="hidden text-xs text-slate-400 sm:inline">A4 · 공통 양식</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={TOOL} disabled={!undo.length} onClick={() => travel("undo")} title="실행 취소" aria-label="실행 취소"><Undo2 size={16} /></button>
        <button type="button" className={TOOL} disabled={!redo.length} onClick={() => travel("redo")} title="다시 실행" aria-label="다시 실행"><Redo2 size={16} /></button>
        <button type="button" className={TOOL} disabled={!report} onClick={copy} title="본문 복사" aria-label="본문 복사"><Copy size={16} /></button>
        <button type="button" className={TOOL} disabled={!report} onClick={download} title="서식 포함 다운로드" aria-label="서식 포함 다운로드"><Download size={16} /></button>
        <button type="button" disabled={!report} onClick={printReport} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-30"><Printer size={16} />PDF / 인쇄</button>
      </div>
    </div>

    {sourceOpen && <section className="mb-4 border-b border-slate-200 bg-white pb-5">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-xs font-semibold text-slate-500">제목<input className={`${INPUT} mt-1`} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} /></label>
        <label className="text-xs font-semibold text-slate-500">작성 부서 / 작성자<input className={`${INPUT} mt-1`} value={writer} onChange={e => setWriter(e.target.value)} maxLength={80} /></label>
        <label className="text-xs font-semibold text-slate-500">작성일<input type="date" className={`${INPUT} mt-1`} value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-500">보고 내용<textarea className={`${INPUT} mt-1 h-48 resize-y py-3 leading-7`} value={source} onChange={e => { sourceChanged.current = true; setSource(e.target.value) }} placeholder={"Ⅰ. 추진 개요\n- 보고 내용을 입력하세요\n\nⅡ. 세부 계획\n가. 추진 방향\n\n| 구분 | 주요 내용 |\n| --- | --- |\n| 추진 과제 | 세부 내용 |\n\nⅢ. 향후 계획"} maxLength={100000} /></label>
      <div className="mt-3 flex justify-end"><button type="button" disabled={!source.trim() || !date} onClick={applySource} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">양식 적용<ArrowRight size={16} /></button></div>
    </section>}

    <div role="status" className="mb-3 min-h-4 text-xs text-slate-500">{message}</div>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
      <div ref={stageRef} className="min-w-0 overflow-hidden border border-slate-200 bg-[#e9edf0] p-4">
        {report ? <div className="report-editor-paper mx-auto bg-white shadow-sm" style={{ width: 794, minHeight: 1123, zoom: scale }}
          onClick={e => selectField(e.target)} onFocus={e => selectField(e.target)}
          dangerouslySetInnerHTML={{ __html: reportHtml(report, true, selected) }} />
          : <div className="flex min-h-[500px] flex-col items-center justify-center gap-3 text-slate-400"><FileText size={40} strokeWidth={1} /><span className="text-sm">작성된 보고서가 없습니다.</span></div>}
      </div>

      <aside className="min-w-0 border border-slate-200 bg-white p-4 xl:sticky xl:top-4" aria-label="보고서 서식 편집">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">{field?.label || "서식"}</h2><button type="button" className="text-slate-400 hover:text-slate-700 disabled:opacity-30" title="선택 항목 서식 초기화" aria-label="선택 항목 서식 초기화" disabled={!field} onClick={() => { if (!report) return; commit({ ...report, fields: { ...report.fields, [selected]: { ...report.fields?.[selected], style: {} } } }) }}><RotateCcw size={15} /></button></div>
        <fieldset disabled={!field} className="space-y-4 disabled:opacity-40">
          <label className="block text-xs font-semibold text-slate-500">내용<textarea aria-label="선택 항목 내용" className={`${INPUT} mt-1 h-24 resize-y py-2 font-normal leading-6`} value={report && field ? fieldText(report, selected, field.text) : ""} onChange={e => setFieldText(e.target.value)} /></label>
          <label className="block text-xs font-semibold text-slate-500">글꼴<select className={`${INPUT} mt-1`} value={style.font} onChange={e => changeStyle({ font: e.target.value as ReportStyle["font"] })}>{Object.entries(REPORT_FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500">크기 (pt)<input type="number" aria-label="글자 크기" min={7} max={48} step={0.5} value={style.size} className={`${INPUT} mt-1`} onChange={e => { if (e.target.value) changeStyle({ size: Math.min(48, Math.max(7, Number(e.target.value))) }) }} /></label>
            <label className="text-xs font-semibold text-slate-500">자간 (px)<input type="number" aria-label="자간" min={0} max={8} step={0.1} value={style.spacing} className={`${INPUT} mt-1`} onChange={e => { if (e.target.value) changeStyle({ spacing: Math.min(8, Math.max(0, Number(e.target.value))) }) }} /></label>
          </div>
          <div className="flex flex-wrap gap-1.5">{[{ label: "굵게", property: "bold", Icon: Bold }, { label: "기울임", property: "italic", Icon: Italic }, { label: "밑줄", property: "underline", Icon: Underline }].map(({ label, property, Icon }) => <button key={property} type="button" title={label} aria-label={label} aria-pressed={Boolean(style[property as keyof ReportStyle])} onClick={() => changeStyle({ [property]: !style[property as keyof ReportStyle] })} className={`${TOOL} ${style[property as keyof ReportStyle] ? "!border-blue-300 !bg-blue-50 !text-blue-700" : ""}`}><Icon size={15} /></button>)}<label title="글자색" className="flex h-9 items-center gap-2 pl-1"><input aria-label="글자색" type="color" className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0" value={style.color} onChange={e => changeStyle({ color: e.target.value })} /></label></div>
          <div className="flex gap-1" role="group" aria-label="정렬">{[{ value: "left", label: "왼쪽 정렬", Icon: AlignLeft }, { value: "center", label: "가운데 정렬", Icon: AlignCenter }, { value: "right", label: "오른쪽 정렬", Icon: AlignRight }, { value: "justify", label: "양쪽 정렬", Icon: AlignJustify }].map(({ value, label, Icon }) => <button key={value} type="button" title={label} aria-label={label} aria-pressed={style.align === value} onClick={() => changeStyle({ align: value as ReportStyle["align"] })} className={`${TOOL} ${style.align === value ? "!border-blue-300 !bg-blue-50 !text-blue-700" : ""}`}><Icon size={15} /></button>)}</div>
          <label className="block text-xs font-semibold text-slate-500">행간 {style.lineHeight}<input type="range" aria-label="행간" min={1} max={3} step={0.05} value={style.lineHeight} onChange={e => changeStyle({ lineHeight: Number(e.target.value) })} className="mt-2 block w-full accent-blue-600" /></label>
          <label className="block text-xs font-semibold text-slate-500">문단 아래 간격 {style.spaceAfter}px<input type="range" aria-label="문단 아래 간격" min={0} max={48} value={style.spaceAfter} onChange={e => changeStyle({ spaceAfter: Number(e.target.value) })} className="mt-2 block w-full accent-blue-600" /></label>
          {field?.kind !== "cell" && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" className="accent-blue-600" checked={Boolean(style.pageBreak)} onChange={e => changeStyle({ pageBreak: e.target.checked })} />PDF에서 새 페이지로 시작</label>}
        </fieldset>
        <fieldset disabled={!report} className="mt-5 space-y-4 border-t border-slate-100 pt-4 disabled:opacity-40"><legend className="pt-4 text-xs font-bold text-slate-700">용지</legend>
          <label className="block text-xs font-semibold text-slate-500">여백 {report?.page?.margin ?? 18}mm<input type="range" aria-label="용지 여백" min={10} max={30} value={report?.page?.margin ?? 18} onChange={e => report && commit({ ...report, page: { ...report.page, margin: Number(e.target.value) } })} className="mt-2 block w-full accent-blue-600" /></label>
          <label className="block text-xs font-semibold text-slate-500">로고 크기 {report?.page?.logoWidth ?? 145}px<input type="range" aria-label="로고 크기" min={80} max={220} value={report?.page?.logoWidth ?? 145} onChange={e => report && commit({ ...report, page: { ...report.page, logoWidth: Number(e.target.value) } })} className="mt-2 block w-full accent-blue-600" /></label>
        </fieldset>
      </aside>
    </div>
  </div>
}
