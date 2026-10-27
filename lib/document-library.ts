import type { DocumentMember } from "./document-collaboration"

export type DocumentMetadata = { id: string; ownerId: string; ownerName: string; title: string; members: DocumentMember[]; createdAt: string; updatedAt: string }
export type DocumentSummary = Omit<DocumentMetadata, "ownerId" | "members"> & { role: "owner" | "editor" | "viewer"; shared: boolean }

function timestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : "" }
export function documentMetadata(raw: unknown): DocumentMetadata | null {
  try {
    const row = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!row || typeof row !== "object" || typeof row.id !== "string" || typeof row.ownerId !== "string") return null
    const members: DocumentMember[] = Array.isArray(row.members) ? row.members.filter((member: any) => member && typeof member.userId === "string" && ["editor", "viewer"].includes(member.role)).map((member: any) => ({ userId: member.userId, name: typeof member.name === "string" ? member.name : "", role: member.role })) : []
    const createdAt = timestamp(row.createdAt)
    return { id: row.id, ownerId: row.ownerId, ownerName: typeof row.ownerName === "string" ? row.ownerName : "", title: typeof row.title === "string" && row.title.trim() ? row.title : "제목 없는 보고서", members, createdAt, updatedAt: timestamp(row.updatedAt) || createdAt }
  } catch { return null }
}

export function buildDocumentLibrary(rows: unknown[], userId: string) {
  const documents: DocumentSummary[] = []
  let unavailableCount = 0
  for (const raw of rows) {
    if (!raw) continue
    const row = documentMetadata(raw)
    if (!row) { unavailableCount++; continue }
    const role = row.ownerId === userId ? "owner" : row.members.find(member => member.userId === userId)?.role
    if (!role) continue
    const { ownerId: _ownerId, members, ...metadata } = row
    documents.push({ ...metadata, role, shared: members.length > 0 })
  }
  documents.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0) || a.id.localeCompare(b.id))
  return { documents, unavailableCount }
}

export function documentSavedAt(value: string) {
  if (!timestamp(value)) return "저장 시각 확인 필요"
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}
