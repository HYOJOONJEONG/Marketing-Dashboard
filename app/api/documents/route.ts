import crypto from "crypto"
import * as Y from "yjs"
import { NextResponse } from "next/server"
import { resolveRequestSession } from "@/lib/auth/session"
import { documentStorage, updateStoredDocument } from "@/lib/document-store"
import { applyReportChange, bytesToBase64, initializeRichDocument, validateReport } from "@/lib/document-collaboration"
import { base64ToBytes, compatibleDocument, DOCUMENT_REQUEST_LIMIT, DOCUMENT_STATE_LIMIT } from "@/lib/document-codec"
import { buildDocumentLibrary } from "@/lib/document-library"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  const session = await resolveRequestSession()
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers })
  try {
    if (new URL(request.url).searchParams.get("directory") === "1") {
      return NextResponse.json({ users: session.state.users.filter(user => user.active && !user.deletedAt).map(user => ({ id: user.id, name: user.name, title: user.title || "", teamName: session.state.teams.find(team => team.id === user.teamId)?.name || "" })) }, { headers })
    }
    const rows = await documentStorage({ action: "list", userId: session.user.id, metadataOnly: true }) as Array<string | null>
    if (!Array.isArray(rows)) throw new Error("Invalid document list response")
    return NextResponse.json(buildDocumentLibrary(rows, session.user.id), { headers })
  } catch (error) {
    console.error("[documents:list]", error instanceof Error ? error.message : "Unknown storage error")
    return NextResponse.json({ error: "문서 목록을 불러오지 못했습니다." }, { status: 503, headers })
  }
}

export async function POST(request: Request) {
  const session = await resolveRequestSession()
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers })
  try {
    const body = await request.json()
    if (new TextEncoder().encode(JSON.stringify(body)).length > DOCUMENT_REQUEST_LIMIT) return NextResponse.json({ error: "문서 저장 데이터 용량 한도를 초과했습니다." }, { status: 413, headers })
    const report = typeof body.reportData === "string" ? JSON.parse(new TextDecoder().decode(base64ToBytes(body.reportData))) : body.report
    if (!validateReport(report)) return NextResponse.json({ error: "문서 내용이 올바르지 않거나 너무 큽니다." }, { status: 400, headers })
    const id = typeof body.id === "string" && /^[a-f0-9-]{36}$/.test(body.id) ? body.id : crypto.randomUUID()
    const doc = new Y.Doc()
    applyReportChange(doc, report)
    initializeRichDocument(doc)
    const state = bytesToBase64(Y.encodeStateAsUpdate(doc))
    doc.destroy()
    if (state.length > DOCUMENT_STATE_LIMIT) return NextResponse.json({ error: "문서 용량 한도를 초과했습니다. 파일로 내려받아 보관해주세요." }, { status: 413, headers })
    const now = new Date().toISOString()
    const document = await updateStoredDocument(id, current => {
      if (current) {
        if (current.ownerId !== session.user.id) throw new Error("접근할 수 없습니다.")
        return null
      }
      return { id, ownerId: session.user.id, ownerName: session.user.name, title: report.fields?.title?.text || report.title, members: [], createdAt: now, updatedAt: now, version: 1, state, presence: [] }
    })
    return NextResponse.json({ document: compatibleDocument(document!, body.encoding), role: "owner" }, { status: 201, headers })
  } catch {
    return NextResponse.json({ error: "문서를 저장하지 못했습니다. 입력 내용은 브라우저에 보관됩니다." }, { status: 503, headers })
  }
}
