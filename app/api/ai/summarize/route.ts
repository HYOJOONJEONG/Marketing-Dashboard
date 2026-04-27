import { NextResponse } from "next/server"
import { requireApiPermission, getRequestIp } from "@/lib/auth/server"
import { appendActivityLog, updateAuthState } from "@/lib/auth/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReportPayload = {
  userName?: string
  teamName?: string
  reportBody?: string
  plannedTasks?: string
}

function buildPrompt(reports: ReportPayload[], reportDate: string) {
  const body = reports
    .map((report) => {
      const name = String(report.userName || "").trim() || "이름없음"
      const team = String(report.teamName || "").trim() || "팀 미지정"
      const reportBody = String(report.reportBody || "").trim() || "없음"
      const plannedTasks = String(report.plannedTasks || "").trim() || "없음"
      return `[${team}] ${name}
업무일지:
${reportBody}

예정사항:
${plannedTasks}`
    })
    .join("\n\n")

  return `다음은 ${reportDate} 인포Biz본부 업무일지 데이터입니다.

[업무일지 본문 및 예정사항]
${body}

아래 형식으로 한국어로 정리해주세요.

1. 금일 주요 업무
2. 주요 이슈
3. 팀별 예정사항
4. 내일 follow-up
5. 보고용 5줄 요약`
}

export async function POST(request: Request) {
  const auth = await requireApiPermission("dailyReport", "view")
  if (!auth.ok) return auth.response

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY 환경변수가 설정되지 않았습니다." }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const reports = Array.isArray(body?.reports) ? body.reports : []
  const reportDate = String(body?.date || "").trim()

  if (!reports.length) {
    return NextResponse.json({ ok: false, error: "요약할 업무일지 데이터가 없습니다." }, { status: 400 })
  }

  const prompt = buildPrompt(reports, reportDate || "오늘")

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL?.trim() || "gpt-4.1",
        input: prompt,
      }),
    })

    const json = await response.json().catch(() => null)
    const summary =
      String(json?.output_text || "").trim() ||
      String(
        json?.output?.flatMap?.((item: any) => item?.content?.map?.((content: any) => content?.text || "") || [])?.join?.("\n") ||
          "",
      ).trim()

    if (!response.ok || !summary) {
      const errorMessage = String(json?.error?.message || "OpenAI 요약 생성에 실패했습니다.")
      return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 })
    }

    await updateAuthState((state) => {
      appendActivityLog(state, {
        actorUserId: auth.context.user.id,
        actorName: auth.context.user.name,
        actionType: "daily_report_ai_summary",
        targetType: "daily_report_summary",
        targetId: reportDate || "today",
        pageKey: "dailyReport",
        beforeValue: "",
        afterValue: JSON.stringify({ reportCount: reports.length }),
        ipAddress: getRequestIp(request),
        sessionId: auth.context.sessionId,
        success: true,
      })
    })

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "AI 요약 생성에 실패했습니다." },
      { status: 500 },
    )
  }
}
