import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { documentStorage, validDocumentId } from "@/lib/document-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.SHARED_KV_API_KEY || process.env.CENTRAL_DB_API_TOKEN || ""
  const input = request.headers.get("x-api-key") || ""
  if (!secret || Buffer.byteLength(input) !== Buffer.byteLength(secret) || !timingSafeEqual(Buffer.from(input), Buffer.from(secret))) {
    return NextResponse.json({ error: "접근할 수 없습니다." }, { status: 403 })
  }
  try {
    const body = await request.json()
    if (!["read", "list", "cas"].includes(body.action) || (body.action === "list" ? typeof body.userId !== "string" : !validDocumentId(String(body.id)))) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
    }
    if (body.action === "cas" && (body.value?.id !== body.id || typeof body.value.ownerId !== "string" || !Array.isArray(body.value.members) || JSON.stringify(body).length > 3000000)) {
      return NextResponse.json({ error: "잘못된 저장 요청입니다." }, { status: 400 })
    }
    return NextResponse.json({ result: await documentStorage(body, true) }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "문서 저장소 요청에 실패했습니다." }, { status: 503 })
  }
}
