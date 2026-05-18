import { Loader2, ShieldCheck } from "lucide-react"

export default function DailyReportLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f8fc] px-4">
      <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-6 text-center shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <div className="mt-5 text-xl font-black text-slate-950">대시보드 들어가는 중</div>
        <div className="mt-2 text-sm font-medium text-slate-500">인증이 완료되어 업무 화면을 준비하고 있습니다.</div>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
          <Loader2 className="h-4 w-4 animate-spin" />
          로딩 중
        </div>
      </div>
    </div>
  )
}
