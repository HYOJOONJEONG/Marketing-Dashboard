"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import type { DocumentReport } from "@/lib/document-report"
import { applyReportChange, base64ToBytes, bytesToBase64, DocumentMember, DocumentPresence, reportFromYDoc, StoredDocument } from "@/lib/document-collaboration"

export type DocumentSummary = { id: string; title: string; ownerName: string; updatedAt: string; shared: boolean; role: "owner" | "editor" | "viewer" }

export function useDocumentCollaboration(userId: string, selection: string, onReport: (report: DocumentReport | null, opened?: boolean) => void, currentReport: DocumentReport | null) {
  const [document, setDocument] = useState<StoredDocument | null>(null)
  const [role, setRole] = useState<"owner" | "editor" | "viewer" | null>(null)
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [presence, setPresence] = useState<DocumentPresence[]>([])
  const [status, setStatus] = useState<"local" | "saving" | "saved" | "offline" | "denied">("local")
  const [error, setError] = useState("")
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const docRef = useRef<Y.Doc | null>(null)
  const undoRef = useRef<Y.UndoManager | null>(null)
  const metaRef = useRef<StoredDocument | null>(null)
  const roleRef = useRef<typeof role>(null)
  const reportCallback = useRef(onReport)
  reportCallback.current = onReport
  const latestReport = useRef(currentReport)
  latestReport.current = currentReport
  const selectionRef = useRef(selection)
  selectionRef.current = selection
  const pending = useRef<Uint8Array[]>([])
  const busy = useRef(false)
  const failures = useRef(0)
  const retryAfter = useRef(0)
  const creating = useRef(false)
  const creationId = useRef<string | null>(null)
  const connectionId = useRef("")
  const syncRef = useRef<() => Promise<boolean>>(async () => true)
  const key = (id: string) => `document-crdt:${userId}:${id}`

  const list = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      setDocuments(json.documents)
    } catch (error) { setError(error instanceof Error ? error.message : "문서 목록을 불러오지 못했습니다.") }
  }, [])

  useEffect(() => { connectionId.current = crypto.randomUUID(); void list() }, [list])
  useEffect(() => () => { docRef.current?.destroy(); undoRef.current?.destroy() }, [])

  function attach(row: StoredDocument, nextRole: typeof role, mergeLocal = true) {
    undoRef.current?.destroy()
    docRef.current?.destroy()
    const doc = new Y.Doc()
    Y.applyUpdate(doc, base64ToBytes(row.state), "remote")
    pending.current = []
    if (mergeLocal && nextRole !== "viewer") {
      try {
        const local = localStorage.getItem(key(row.id))
        if (local) {
          const serverVector = Y.encodeStateVector(doc)
          Y.applyUpdate(doc, base64ToBytes(local), "recovery")
          const difference = Y.encodeStateAsUpdate(doc, serverVector)
          if (difference.length > 2) pending.current.push(difference)
        }
      } catch { setError("임시 보관 내용을 복구하지 못했습니다.") }
    }
    const report = reportFromYDoc(doc)
    docRef.current = doc
    metaRef.current = row
    roleRef.current = nextRole
    setDocument(row)
    setRole(nextRole)
    const manager = new Y.UndoManager(Array.from(doc.share.values()), { trackedOrigins: new Set(["local"]), captureTimeout: 500 })
    undoRef.current = manager
    const updateUndo = () => { setCanUndo(manager.undoStack.length > 0); setCanRedo(manager.redoStack.length > 0) }
    manager.on("stack-item-added", updateUndo)
    manager.on("stack-item-popped", updateUndo)
    manager.on("stack-cleared", updateUndo)
    updateUndo()
    doc.on("update", (update, origin) => {
      if (origin !== "remote") { pending.current.push(update); setStatus("saving") }
      try { localStorage.setItem(key(row.id), bytesToBase64(Y.encodeStateAsUpdate(doc))) }
      catch { setError("이 브라우저의 보관 공간이 부족합니다. 서버 저장 상태를 확인해주세요.") }
      reportCallback.current(reportFromYDoc(doc))
      updateUndo()
    })
    setStatus(pending.current.length ? "saving" : "saved")
    failures.current = 0
    retryAfter.current = 0
    setError("")
    reportCallback.current(report, true)
  }

  async function open(id: string) {
    if (metaRef.current && status !== "denied" && !await syncRef.current()) return false
    try {
      const response = await fetch(`/api/documents/${id}?encoding=gzip`, { cache: "no-store" })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      if (json.role !== "viewer") {
        const existing = new Y.Doc()
        let initialized: boolean
        try { Y.applyUpdate(existing, base64ToBytes(json.document.state)); initialized = Boolean(existing.getMap("report").get("richInitialized")) }
        finally { existing.destroy() }
        if (initialized) { attach(json.document, json.role); return true }
        let recovery: string | null = null
        try { const cached = localStorage.getItem(key(id)); if (cached) recovery = bytesToBase64(base64ToBytes(cached)) } catch {}
        const initialization = await fetch(`/api/documents/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "initialize", encoding: "gzip", ...(recovery ? { update: recovery } : {}) }) })
        const migrated = await initialization.json()
        if (!initialization.ok) throw new Error(migrated.error)
        attach(migrated.document, migrated.role)
        return true
      }
      attach(json.document, json.role)
      return true
    } catch (error) { setError(error instanceof Error ? error.message : "문서를 열지 못했습니다."); return false }
  }

  async function create(report: DocumentReport) {
    if (creating.current) return false
    creating.current = true
    setStatus("saving")
    let id = creationId.current
    try { id ||= sessionStorage.getItem(`document-creation:${userId}`) } catch {}
    id ||= crypto.randomUUID()
    creationId.current = id
    try { sessionStorage.setItem(`document-creation:${userId}`, id) } catch {}
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, reportData: bytesToBase64(new TextEncoder().encode(JSON.stringify(report))), encoding: "gzip" }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      const latest = latestReport.current || report
      attach(json.document, json.role, false)
      if (docRef.current) applyReportChange(docRef.current, latest, reportFromYDoc(docRef.current))
      creationId.current = null
      try { sessionStorage.removeItem(`document-creation:${userId}`) } catch {}
      void list()
      return true
    } catch (error) { setStatus("offline"); setError(error instanceof Error ? error.message : "임시저장에 실패했습니다."); return false }
    finally { creating.current = false }
  }

  syncRef.current = async () => {
    const doc = docRef.current
    const meta = metaRef.current
    if (!doc || !meta) return true
    if (busy.current || status === "denied") return false
    if (Date.now() < retryAfter.current) return false
    busy.current = true
    const outgoing = pending.current.splice(0)
    try {
      const response = await fetch(`/api/documents/${meta.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sync", encoding: "gzip", vector: bytesToBase64(Y.encodeStateVector(doc)), ...(outgoing.length ? { update: bytesToBase64(Y.mergeUpdates(outgoing)) } : {}), field: selectionRef.current, connectionId: connectionId.current }), signal: AbortSignal.timeout(12000) })
      const json = await response.json()
      if (docRef.current !== doc) return true
      if (response.status === 403 || response.status === 401) {
        setStatus("denied"); setRole(null); roleRef.current = null; setError(json.error || "접근 권한이 없습니다.")
        if (response.status === 403) { localStorage.removeItem(key(meta.id)); reportCallback.current(null) }
        return false
      }
      if (!response.ok) throw new Error(json.error)
      Y.applyUpdate(doc, base64ToBytes(json.update), "remote")
      setPresence(json.presence)
      setRole(json.role)
      roleRef.current = json.role
      const next = { ...meta, members: json.members, updatedAt: json.updatedAt, version: json.version }
      metaRef.current = next
      setDocument(next)
      setStatus(pending.current.length ? "saving" : "saved")
      failures.current = 0
      retryAfter.current = 0
      setError("")
      return !pending.current.length
    } catch (error) {
      if (docRef.current === doc) {
        pending.current.unshift(...outgoing)
        setStatus("offline")
        failures.current++
        retryAfter.current = Date.now() + Math.min(30000, 1000 * 2 ** Math.min(failures.current, 5))
        setError(error instanceof Error ? error.message : "연결이 끊겼습니다. 변경 내용은 보관됩니다.")
      }
      return false
    } finally { busy.current = false }
  }

  useEffect(() => {
    if (!document?.id) return
    const interval = setInterval(() => { if (!window.document.hidden || pending.current.length) void syncRef.current() }, 2000)
    const onFocus = () => { retryAfter.current = 0; void syncRef.current() }
    const onLeave = (event: BeforeUnloadEvent) => { if (pending.current.length) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("focus", onFocus)
    window.addEventListener("online", onFocus)
    window.addEventListener("beforeunload", onLeave)
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("beforeunload", onLeave) }
  }, [document?.id])

  function apply(next: DocumentReport, previous: DocumentReport) {
    if (!docRef.current || !["owner", "editor"].includes(roleRef.current || "")) return false
    applyReportChange(docRef.current, next, previous)
    undoRef.current?.addToScope(Array.from(docRef.current.share.values()))
    return true
  }
  async function changeMember(memberId: string, memberRole: DocumentMember["role"] | "remove") {
    if (!metaRef.current || roleRef.current !== "owner") return
    try {
      const response = await fetch(`/api/documents/${metaRef.current.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "members", userId: memberId, role: memberRole }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error)
      const next = { ...metaRef.current, members: json.members }
      metaRef.current = next
      setDocument(next)
      setError("")
      void list()
    } catch (error) { setError(error instanceof Error ? error.message : "초대 권한을 변경하지 못했습니다.") }
  }
  async function detach() {
    if (metaRef.current && status !== "denied" && !await syncRef.current()) return false
    undoRef.current?.destroy(); docRef.current?.destroy()
    docRef.current = null; metaRef.current = null; roleRef.current = null; creationId.current = null; pending.current = []
    setDocument(null); setRole(null); setStatus("local"); setPresence([]); setError("")
    return true
  }
  return { yDoc: docRef.current, document, role, documents, presence, status, error, list, open, create, apply, detach, changeMember, save: () => { retryAfter.current = 0; return syncRef.current() }, canUndo, canRedo,
    undo: () => undoRef.current?.undo(), redo: () => undoRef.current?.redo() }
}
