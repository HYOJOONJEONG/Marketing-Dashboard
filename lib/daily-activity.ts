import type { ActivityLogRecord } from "@/lib/auth/model"

const labels: Record<string, string> = {
  login: "로그인", logout: "로그아웃", dashboard_put: "데이터 저장",
  manual_input_save: "수동입력 저장", contract_create: "계약 등록", contract_update: "계약 수정",
  profile_update: "내 정보 수정", permission_update: "권한 변경", user_update: "사용자 수정",
  backup_restore: "백업 복원", password_change: "비밀번호 변경",
}
const pages: Record<string, string> = {
  dailyReport: "업무일지", weeklyReport: "주간실적보고", manualInput: "수동입력",
  newContractsList: "신규계약", weeklySelection: "주간반영", typeAnalysis: "유형분석",
  collectionManagement: "계약서관리", terminationManagement: "해지관리", optionDashboard: "유료옵션",
}

export function dailyActivityRows(rows: ActivityLogRecord[], userId: string, canViewAll: boolean, now = new Date()) {
  const day = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(value)
  const today = day(now)
  return rows.filter(row => {
    const date = new Date(row.createdAt)
    return (canViewAll || row.actorUserId === userId) && Number.isFinite(date.getTime()) && day(date) === today
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100).map(row => ({
    id: row.id, actorName: row.actorName, createdAt: row.createdAt, success: row.success,
    label: [pages[row.pageKey], labels[row.actionType] || "활동 기록"].filter(Boolean).join(" · "),
  }))
}
