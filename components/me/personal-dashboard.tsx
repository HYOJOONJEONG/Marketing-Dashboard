"use client"

import { useState, useTransition } from "react"
import { WorkspaceHeader } from "@/components/auth/workspace-header"

type Props = {
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    color: { bg: string; text: string; border: string; hex: string }
    assignedIndustries?: string[]
  }
  data: {
    myContracts: any[]
    myContractMonthlySummary: Array<{ month: string; total: number; pending: number; recovered: number }>
    myPendingDocuments: any[]
    myTerminationRows: any[]
    assignedIndustries: string[]
  }
}

const cardClass = "rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"

function formatValue(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim()
  return text || fallback
}

export function PersonalDashboard({ currentUser, data }: Props) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  const updatePassword = () => {
    setMessage("")
    if (!currentPassword || !nextPassword || !confirmPassword) {
      setMessage("비밀번호 항목을 모두 입력해주세요.")
      return
    }
    if (nextPassword !== confirmPassword) {
      setMessage("새 비밀번호 확인이 일치하지 않습니다.")
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, nextPassword }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setMessage(payload?.error || "비밀번호 변경에 실패했습니다.")
        return
      }
      setCurrentPassword("")
      setNextPassword("")
      setConfirmPassword("")
      setMessage("비밀번호가 변경되었습니다.")
    })
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] px-4 py-4">
      <WorkspaceHeader currentPage="개인페이지" currentSection="my-dashboard" currentUser={currentUser} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.03em] text-slate-950">{currentUser.name} 개인 대시보드</h2>
                <p className="mt-1 text-sm text-slate-500">내 신규계약, 내 미회수 계약서, 내 해지 현황을 한 번에 봅니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.assignedIndustries.length ? (
                  data.assignedIndustries.map((industry) => (
                    <span key={industry} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {industry}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">담당 업종 미지정</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className={cardClass}>
              <div className="text-sm font-semibold text-slate-500">내 신규계약</div>
              <div className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950">{data.myContracts.length}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm font-semibold text-slate-500">내 미회수 계약서</div>
              <div className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950">{data.myPendingDocuments.length}</div>
            </div>
            <div className={cardClass}>
              <div className="text-sm font-semibold text-slate-500">나의 해지 리스트</div>
              <div className="mt-3 text-3xl font-black tracking-[-0.03em] text-slate-950">{data.myTerminationRows.length}</div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">1. 내 신규계약 리스트</h3>
                <p className="mt-1 text-sm text-slate-500">이름 기준으로 등록된 계약을 월별로 정리했습니다.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.myContractMonthlySummary.length ? (
                data.myContractMonthlySummary.map((item) => (
                  <div key={item.month} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm font-bold text-slate-800">{item.month}</div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <span>총 {item.total}</span>
                      <span>미회수 {item.pending}</span>
                      <span>회수 {item.recovered}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">등록된 신규계약이 없습니다.</div>
              )}
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    {["회사명", "부서", "ID", "업종", "계약월", "계약서 상태"].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.myContracts.slice(0, 30).map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                      <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                      <td className="px-4 py-3">{formatValue(row.idCode)}</td>
                      <td className="px-4 py-3">{formatValue(row.industry)}</td>
                      <td className="px-4 py-3">{formatValue(row.contractMonth)}</td>
                      <td className="px-4 py-3">{formatValue(row.documentStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">2. 내 이름으로 된 계약서 미회수 현황</h3>
            <p className="mt-1 text-sm text-slate-500">관리자페이지에서 지정한 담당 업종 기준으로 미회수 건만 모아 보여줍니다.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    {["회사명", "부서", "ID", "업종", "청구월", "상태"].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.myPendingDocuments.length ? (
                    data.myPendingDocuments.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                        <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                        <td className="px-4 py-3">{formatValue(row.idCode)}</td>
                        <td className="px-4 py-3">{formatValue(row.industry)}</td>
                        <td className="px-4 py-3">{formatValue(row.claimMonth)}</td>
                        <td className="px-4 py-3">{formatValue(row.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                        {data.assignedIndustries.length ? "미회수 계약서가 없습니다." : "먼저 관리자페이지에서 담당 업종을 지정해주세요."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cardClass}>
            <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">3. 나의 해지 리스트</h3>
            <p className="mt-1 text-sm text-slate-500">해지 진행, 확정, 청구보류까지 내 이름으로 배정된 건을 모았습니다.</p>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    {["구분", "고객사", "부서", "고객번호", "사유", "해지일"].map((head) => (
                      <th key={head} className="px-4 py-3 text-left font-semibold">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.myTerminationRows.length ? (
                    data.myTerminationRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{row.sectionLabel}</span>
                        </td>
                        <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                        <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                        <td className="px-4 py-3">{formatValue(row.customerId)}</td>
                        <td className="px-4 py-3">{formatValue(row.reason)}</td>
                        <td className="px-4 py-3">{formatValue(row.terminationDate)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">배정된 해지 리스트가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className={cardClass}>
            <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">비밀번호 변경</h3>
            <p className="mt-1 text-sm text-slate-500">현재 비밀번호 확인 후 개인 비밀번호로 바꿀 수 있습니다.</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-700">현재 비밀번호</div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </label>
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-700">새 비밀번호</div>
                <input
                  type="password"
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </label>
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-slate-700">새 비밀번호 확인</div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </label>
              {message ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div>
              ) : null}
              <button
                type="button"
                onClick={updatePassword}
                disabled={isPending}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                {isPending ? "변경 중..." : "비밀번호 변경"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
