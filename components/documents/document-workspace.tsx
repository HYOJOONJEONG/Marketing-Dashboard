"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowRight, Bold, Check, Cloud, CloudOff, Copy, Download, FileText, FolderOpen, Italic, Loader2, LockKeyhole, PanelLeftClose, PanelLeftOpen, Plus, Printer, Redo2, RotateCcw, Save, Underline, Undo2, Users } from "lucide-react"
import { DocumentReport, ReportStyle, defaultFieldStyle, fieldText, formatDocumentReport, reportFields, reportHtml, reportPlainText, REPORT_CSS, REPORT_FONTS } from "@/lib/document-report"
import { NumberControl } from "./number-control"
import { useDocumentCollaboration } from "./use-document-collaboration"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [sharingOpen, setSharingOpen] = useState(false)
  const [directory, setDirectory] = useState<Array<{ id: string; name: string; title: string; teamName: string }>>([])
  const [inviteId, setInviteId] = useState("")
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor")
  const [search, setSearch] = useState("")
  const stageRef = useRef<HTMLDivElement>(null)
  const sourceChanged = useRef(false)
  const draftKey = `document-report-draft:${userId}`
  const collaboration = useDocumentCollaboration(userId, selected, (next, opened) => {
    setReport(next)
    if (opened && next) {
      setReady(true)
      setTitle(next.title); setDate(next.date); setWriter(next.author)
      setSource(next.sections.map((section, index) => `${index + 1}. ${section.heading}\n${section.content}`).join("\n\n"))
      setSourceOpen(false); setSelected("title"); setUndo([]); setRedo([])
      sourceChanged.current = false
    }
  }, report)
  const canEdit = !collaboration.document || collaboration.role === "owner" || collaboration.role === "editor"

  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored)
        if (typeof draft.documentId === "string") {
          void collaboration.open(draft.documentId)
          return
        }
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
    try { localStorage.setItem(draftKey, JSON.stringify(collaboration.document ? { documentId: collaboration.document.id } : { source, title, date, writer, report })) }
    catch { setMessage("임시 보관 공간이 부족합니다. 파일로 내려받아 주세요.") }
  }, [source, title, date, writer, report, draftKey, ready, collaboration.document?.id])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, Math.max(0.2, entry.contentRect.width / 794))))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!sourceChanged.current || !ready || !source.trim() || collaboration.document) return
    const timer = setTimeout(() => {
      // Existing edits are only replaced by the explicit apply action.
      if (!report?.fields || !Object.keys(report.fields).length) {
        sourceChanged.current = false
        setReport(formatDocumentReport(source, { title, date, author: writer }))
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [source, title, date, writer, ready, report, collaboration.document?.id])

  const fields = useMemo(() => report ? reportFields(report) : [], [report])
  const field = fields.find(item => item.key === selected)
  const style: ReportStyle = { ...defaultFieldStyle(field?.kind || "body"), ...(selected.includes(".r0.") ? { bold: true } : {}), ...report?.fields?.[selected]?.style }

  function commit(next: DocumentReport) {
    if (!canEdit) return
    if (collaboration.document && report) { collaboration.apply(next, report); return }
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
    if (collaboration.document) { if (direction === "undo") collaboration.undo(); else collaboration.redo(); return }
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
  async function saveDraft() {
    if (!report) return
    if (collaboration.document) await collaboration.save()
    else await collaboration.create(report)
  }
  async function newReport() {
    if (report && !collaboration.document && !await collaboration.create(report)) return
    if (!await collaboration.detach()) return
    setReady(true)
    setSource(""); setTitle("업무 보고서"); setWriter(department || author); setReport(null); setSourceOpen(true); setUndo([]); setRedo([]); setMessage(""); setSelected("title")
  }
  async function openSharing() {
    if (!report) return
    if (!collaboration.document && !await collaboration.create(report)) return
    setSharingOpen(true)
    try {
      const response = await fetch("/api/documents?directory=1", { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      setDirectory(json.users)
    } catch { setMessage("초대할 사용자 목록을 불러오지 못했습니다.") }
  }
  async function openDocument(id: string) {
    if (report && !collaboration.document && !await collaboration.create(report)) return
    if (await collaboration.open(id)) setLibraryOpen(false)
  }
  const peers = collaboration.presence.filter(person => person.userId !== userId)
  const peerFields = Object.fromEntries(peers.map(person => [person.field, person.name]))
  const statusLabel = collaboration.document
    ? ({ local: "브라우저 임시 보관", saving: "서버 저장 중", saved: "서버 저장 완료", offline: "연결 끊김 · 재시도 중", denied: "권한 확인 필요" })[collaboration.status]
    : "비공개 · 브라우저 임시 보관"
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="flex items-center gap-2">
        <button type="button" className={TOOL} onClick={() => { setLibraryOpen(true); void collaboration.list() }} title="내 문서" aria-label="내 문서"><FolderOpen size={17} /></button>
        <button type="button" className={TOOL} onClick={newReport} title="새 보고서" aria-label="새 보고서"><Plus size={17} /></button>
        <button type="button" className={TOOL} onClick={() => setSourceOpen(value => !value)} title="원문 입력" aria-label="원문 입력" aria-expanded={sourceOpen}>{sourceOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}</button>
        <div className="ml-1 min-w-0"><span className="block max-w-64 truncate text-sm font-bold text-slate-800">{report ? fieldText(report, "title", report.title) : "새 보고서"}</span><span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">{collaboration.document?.members.length ? <Users size={11} /> : <LockKeyhole size={11} />}{collaboration.document?.members.length ? "초대 멤버 전용" : "나만 볼 수 있음"} · A4</span></div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className={TOOL} disabled={!canEdit || !(collaboration.document ? collaboration.canUndo : undo.length)} onClick={() => travel("undo")} title="실행 취소" aria-label="실행 취소"><Undo2 size={16} /></button>
        <button type="button" className={TOOL} disabled={!canEdit || !(collaboration.document ? collaboration.canRedo : redo.length)} onClick={() => travel("redo")} title="다시 실행" aria-label="다시 실행"><Redo2 size={16} /></button>
        <button type="button" className={TOOL} disabled={!report} onClick={copy} title="본문 복사" aria-label="본문 복사"><Copy size={16} /></button>
        <button type="button" className={TOOL} disabled={!report} onClick={download} title="서식 포함 다운로드" aria-label="서식 포함 다운로드"><Download size={16} /></button>
        <button type="button" disabled={!report || !canEdit} onClick={saveDraft} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"><Save size={16} />임시저장</button>
        <button type="button" disabled={!report || Boolean(collaboration.document && collaboration.role !== "owner")} onClick={openSharing} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"><Users size={16} />초대</button>
        <button type="button" disabled={!report} onClick={printReport} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-30"><Printer size={16} />PDF / 인쇄</button>
      </div>
    </div>

    {sourceOpen && <fieldset disabled={!canEdit} className="mb-4 border-b border-slate-200 bg-white pb-5 disabled:opacity-60">
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <label className="text-xs font-semibold text-slate-500">제목<input className={`${INPUT} mt-1`} value={title} onChange={e => setTitle(e.target.value)} maxLength={150} /></label>
        <label className="text-xs font-semibold text-slate-500">작성 부서 / 작성자<input className={`${INPUT} mt-1`} value={writer} onChange={e => setWriter(e.target.value)} maxLength={80} /></label>
        <label className="text-xs font-semibold text-slate-500">작성일<input type="date" className={`${INPUT} mt-1`} value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-500">보고 내용<textarea className={`${INPUT} mt-1 h-48 resize-y py-3 leading-7`} value={source} onChange={e => { sourceChanged.current = true; setSource(e.target.value) }} placeholder={"Ⅰ. 추진 개요\n- 보고 내용을 입력하세요\n\nⅡ. 세부 계획\n가. 추진 방향\n\n| 구분 | 주요 내용 |\n| --- | --- |\n| 추진 과제 | 세부 내용 |\n\nⅢ. 향후 계획"} maxLength={100000} /></label>
      <div className="mt-3 flex justify-end"><button type="button" disabled={!source.trim() || !date} onClick={applySource} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">양식 적용<ArrowRight size={16} /></button></div>
    </fieldset>}

    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="status" className={`flex items-center gap-1.5 text-xs ${collaboration.status === "offline" || collaboration.status === "denied" ? "text-rose-600" : "text-slate-500"}`}>{collaboration.status === "saving" ? <Loader2 size={13} className="animate-spin" /> : collaboration.status === "offline" ? <CloudOff size={13} /> : collaboration.document ? <Cloud size={13} /> : <LockKeyhole size={13} />}{statusLabel}{collaboration.role === "viewer" ? " · 읽기 전용" : ""}</div>
      <div className="flex items-center gap-1.5">{Array.from(new Map(collaboration.presence.map(person => [person.userId, person])).values()).map(person => <span key={person.userId} title={`${person.name}${person.userId === userId ? " (나)" : " · 접속 중"}`} className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${person.userId === userId ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>{person.name.slice(-2)}</span>)}</div>
    </div>
    {collaboration.error ? <div role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{collaboration.error}</div> : null}
    {message && !collaboration.document ? <div className="mb-3 text-xs text-slate-500">{message}</div> : null}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
      <div ref={stageRef} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-[#e9edf0] px-4 py-6">
        {report ? <div className="report-editor-paper mx-auto bg-white shadow-sm" style={{ width: 794, minHeight: 1123, zoom: scale }}
          onClick={e => selectField(e.target)} onFocus={e => selectField(e.target)}
          dangerouslySetInnerHTML={{ __html: reportHtml(report, true, selected, peerFields) }} />
          : <div className="flex min-h-[500px] flex-col items-center justify-center gap-3 text-slate-400"><FileText size={40} strokeWidth={1} /><span className="text-sm">작성된 보고서가 없습니다.</span></div>}
      </div>

      <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4" aria-label="보고서 서식 편집">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">{field?.label || "서식"}</h2><button type="button" className="text-slate-400 hover:text-slate-700 disabled:opacity-30" title="선택 항목 서식 초기화" aria-label="선택 항목 서식 초기화" disabled={!field} onClick={() => { if (!report) return; commit({ ...report, fields: { ...report.fields, [selected]: { ...report.fields?.[selected], style: {} } } }) }}><RotateCcw size={15} /></button></div>
        {peers.some(person => person.field === selected) ? <div className="mb-4 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">{peers.filter(person => person.field === selected).map(person => person.name).join(", ")} 님 편집 중</div> : null}
        <fieldset disabled={!field || !canEdit} className="space-y-4 disabled:opacity-40">
          <label className="block text-xs font-semibold text-slate-500">내용<textarea aria-label="선택 항목 내용" className={`${INPUT} mt-1 h-24 resize-y py-2 font-normal leading-6`} value={report && field ? fieldText(report, selected, field.text) : ""} onChange={e => setFieldText(e.target.value)} /></label>
          <label className="block text-xs font-semibold text-slate-500">글꼴<select className={`${INPUT} mt-1`} value={style.font} onChange={e => changeStyle({ font: e.target.value as ReportStyle["font"] })}>{Object.entries(REPORT_FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500">크기 (pt)<NumberControl key={`${selected}-size`} label="글자 크기" min={7} max={48} step={0.5} value={style.size!} className={`${INPUT} mt-1`} onCommit={value => changeStyle({ size: value })} /></label>
            <label className="text-xs font-semibold text-slate-500">자간 (px)<NumberControl key={`${selected}-spacing`} label="자간" min={0} max={8} step={0.1} value={style.spacing!} className={`${INPUT} mt-1`} onCommit={value => changeStyle({ spacing: value })} /></label>
          </div>
          <div className="flex flex-wrap gap-1.5">{[{ label: "굵게", property: "bold", Icon: Bold }, { label: "기울임", property: "italic", Icon: Italic }, { label: "밑줄", property: "underline", Icon: Underline }].map(({ label, property, Icon }) => <button key={property} type="button" title={label} aria-label={label} aria-pressed={Boolean(style[property as keyof ReportStyle])} onClick={() => changeStyle({ [property]: !style[property as keyof ReportStyle] })} className={`${TOOL} ${style[property as keyof ReportStyle] ? "!border-blue-300 !bg-blue-50 !text-blue-700" : ""}`}><Icon size={15} /></button>)}<label title="글자색" className="flex h-9 items-center gap-2 pl-1"><input aria-label="글자색" type="color" className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0" value={style.color} onChange={e => changeStyle({ color: e.target.value })} /></label></div>
          <div className="flex gap-1" role="group" aria-label="정렬">{[{ value: "left", label: "왼쪽 정렬", Icon: AlignLeft }, { value: "center", label: "가운데 정렬", Icon: AlignCenter }, { value: "right", label: "오른쪽 정렬", Icon: AlignRight }, { value: "justify", label: "양쪽 정렬", Icon: AlignJustify }].map(({ value, label, Icon }) => <button key={value} type="button" title={label} aria-label={label} aria-pressed={style.align === value} onClick={() => changeStyle({ align: value as ReportStyle["align"] })} className={`${TOOL} ${style.align === value ? "!border-blue-300 !bg-blue-50 !text-blue-700" : ""}`}><Icon size={15} /></button>)}</div>
          <label className="block text-xs font-semibold text-slate-500">행간 {style.lineHeight}<input type="range" aria-label="행간" min={1} max={3} step={0.05} value={style.lineHeight} onChange={e => changeStyle({ lineHeight: Number(e.target.value) })} className="mt-2 block w-full accent-blue-600" /></label>
          <label className="block text-xs font-semibold text-slate-500">문단 아래 간격 {style.spaceAfter}px<input type="range" aria-label="문단 아래 간격" min={0} max={48} value={style.spaceAfter} onChange={e => changeStyle({ spaceAfter: Number(e.target.value) })} className="mt-2 block w-full accent-blue-600" /></label>
          {field?.kind !== "cell" && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" className="accent-blue-600" checked={Boolean(style.pageBreak)} onChange={e => changeStyle({ pageBreak: e.target.checked })} />PDF에서 새 페이지로 시작</label>}
        </fieldset>
        <fieldset disabled={!report || !canEdit} className="mt-5 space-y-4 border-t border-slate-100 pt-4 disabled:opacity-40"><legend className="pt-4 text-xs font-bold text-slate-700">용지</legend>
          <label className="block text-xs font-semibold text-slate-500">여백 {report?.page?.margin ?? 18}mm<input type="range" aria-label="용지 여백" min={10} max={30} value={report?.page?.margin ?? 18} onChange={e => report && commit({ ...report, page: { ...report.page, margin: Number(e.target.value) } })} className="mt-2 block w-full accent-blue-600" /></label>
          <label className="block text-xs font-semibold text-slate-500">로고 크기 {report?.page?.logoWidth ?? 145}px<input type="range" aria-label="로고 크기" min={80} max={220} value={report?.page?.logoWidth ?? 145} onChange={e => report && commit({ ...report, page: { ...report.page, logoWidth: Number(e.target.value) } })} className="mt-2 block w-full accent-blue-600" /></label>
        </fieldset>
      </aside>
    </div>
    <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}><DialogContent className="max-w-xl rounded-lg"><DialogHeader><DialogTitle>내 문서</DialogTitle></DialogHeader>
      <input aria-label="문서 검색" placeholder="문서 제목 검색" className={INPUT} value={search} onChange={event => setSearch(event.target.value)} />
      <div className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto">{collaboration.documents.filter(document => document.title.includes(search)).map(document => <button type="button" key={document.id} onClick={() => openDocument(document.id)} className="flex w-full items-center gap-3 px-2 py-4 text-left hover:bg-slate-50"><FileText size={20} className="shrink-0 text-blue-500" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-slate-800">{document.title}</div><div className="mt-1 text-xs text-slate-400">{document.ownerName} · {new Date(document.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div><span className="shrink-0 text-xs text-slate-500">{document.role === "owner" ? document.shared ? "공유 중" : "비공개" : document.role === "editor" ? "공동 편집" : "열람"}</span></button>)}{!collaboration.documents.length ? <div className="py-10 text-center text-sm text-slate-400">저장된 문서가 없습니다.</div> : null}</div>
    </DialogContent></Dialog>
    <Dialog open={sharingOpen} onOpenChange={setSharingOpen}><DialogContent className="max-w-lg rounded-lg"><DialogHeader><DialogTitle>문서 초대</DialogTitle></DialogHeader>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4 text-xs text-slate-500"><LockKeyhole size={14} />초대한 계정만 접근할 수 있습니다.</div>
      <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2"><select aria-label="초대할 사용자" className={INPUT} value={inviteId} onChange={event => setInviteId(event.target.value)}><option value="">사용자 선택</option>{directory.filter(person => person.id !== userId && !collaboration.document?.members.some(member => member.userId === person.id)).map(person => <option key={person.id} value={person.id}>{person.name} {person.title} · {person.teamName}</option>)}</select><select aria-label="초대 권한" className={INPUT} value={inviteRole} onChange={event => setInviteRole(event.target.value as typeof inviteRole)}><option value="editor">편집 가능</option><option value="viewer">열람만</option></select><button type="button" disabled={!inviteId} onClick={async () => { await collaboration.changeMember(inviteId, inviteRole); setInviteId("") }} className="rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-40">초대</button></div>
      <div className="divide-y divide-slate-100"><div className="flex items-center justify-between py-3 text-sm"><span className="font-semibold text-slate-800">{collaboration.document?.ownerName}</span><span className="text-xs text-slate-400">소유자</span></div>{collaboration.document?.members.map(member => <div key={member.userId} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{member.name}</span><select aria-label={`${member.name} 문서 권한`} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" value={member.role} onChange={event => collaboration.changeMember(member.userId, event.target.value as "editor" | "viewer" | "remove")}><option value="editor">편집 가능</option><option value="viewer">열람만</option><option value="remove">초대 취소</option></select></div>)}</div>
    </DialogContent></Dialog>
  </div>
}
