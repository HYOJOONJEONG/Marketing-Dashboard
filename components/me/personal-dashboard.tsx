"use client"

import type { ReactNode } from "react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BriefcaseBusiness, ChevronDown, FolderClock, Landmark, Sparkles, UserRound } from "lucide-react"

type Props = {
  currentUser: {
    id: string
    name: string
    role: string
    teamName: string
    avatarEmoji?: string | null
    color: { bg: string; text: string; border: string; hex: string }
    assignedIndustries?: string[]
  }
  data: {
    myContracts: any[]
    myContractMonthlySummary: Array<{ month: string; total: number; pending: number; recovered: number }>
    myPendingDocuments: any[]
    pendingDocumentSource: any[]
    myTerminationRows: any[]
    myHoldRows: any[]
    assignedIndustries: string[]
    industryOptions: string[]
  }
}

const cardClass = "rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]"
const avatarOptions = ["😀", "😎", "🧑‍💼", "📈", "💼", "🦊", "🐯", "⭐", "🚀", "🧠", "🫶", "🔥", "🐻", "🐼", "🦁", "🐸", "🌈", "⚡", "🎯", "🎧", "☕", "🍀", "🪐", "🎨"]

function formatValue(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim()
  return text || fallback
}

function terminationBadgeClass(label: string) {
  if (label === "해지 진행") {
    return "border-orange-200 bg-orange-50 text-orange-700"
  }
  if (label === "해지 확정") {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }
  return "border-amber-200 bg-amber-50 text-amber-700"
}

function MetricCard({
  title,
  value,
  tone,
  icon,
}: {
  title: string
  value: number
  tone: string
  icon: ReactNode
}) {
  return (
    <div className={`${cardClass} overflow-hidden p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-500">{title}</div>
          <div className="mt-4 text-[26px] font-black tracking-[-0.05em] text-slate-950">{value}</div>
        </div>
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      </div>
    </div>
  )
}

export function PersonalDashboard({ currentUser, data }: Props) {
  const router = useRouter()
  const [profileMessage, setProfileMessage] = useState("")
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(data.assignedIndustries || [])
  const [selectedAvatar, setSelectedAvatar] = useState<string>(String(currentUser.avatarEmoji || "").trim())
  const [isIndustryOpen, setIsIndustryOpen] = useState(false)
  const [isAvatarOpen, setIsAvatarOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const pendingDocuments = useMemo(() => {
    return (data.pendingDocumentSource || []).filter((row) => {
      const industry = String(row?.industryGroup || row?.industry || "").trim()
      const status = String(row?.status || "").trim()
      return selectedIndustries.includes(industry) && status !== "회수"
    })
  }, [data.pendingDocumentSource, selectedIndustries])

  const selectedIndustryLabels = useMemo(
    () => selectedIndustries.slice().sort((a, b) => a.localeCompare(b, "ko")),
    [selectedIndustries],
  )

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((item) => item !== industry) : [...prev, industry],
    )
  }

  const saveProfile = () => {
    setProfileMessage("")
    startTransition(async () => {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignedIndustries: selectedIndustries,
          avatarEmoji: selectedAvatar || null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        setProfileMessage(payload?.error || "프로필 저장에 실패했습니다.")
        return
      }
      setSelectedIndustries(Array.isArray(payload?.assignedIndustries) ? payload.assignedIndustries : selectedIndustries)
      setSelectedAvatar(String(payload?.avatarEmoji || "").trim())
      setProfileMessage("내 프로필 설정이 저장되었습니다.")
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff_0%,#f8fbff_36%,#f3f6fb_100%)] px-4 py-3">
      <div className="mx-auto max-w-[1680px]">
        <div className="space-y-4">
          <section className={`${cardClass} relative z-20 overflow-visible p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${currentUser.color.border} ${currentUser.color.bg} text-[22px] shadow-sm`}
                >
                  {selectedAvatar || currentUser.avatarEmoji || currentUser.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[20px] font-black tracking-[-0.05em] text-slate-950">{currentUser.name}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">{currentUser.role}</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-semibold text-blue-700">{currentUser.teamName}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                      담당업종 {selectedIndustryLabels.length || 0}개
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarOpen(false)
                      setIsIndustryOpen((prev) => !prev)
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    담당 업종 선택
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isIndustryOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isIndustryOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[300px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                      <div className="mb-2 text-xs font-semibold text-slate-400">미회수 현황 집계 기준</div>
                      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {(data.industryOptions || []).map((industry) => {
                          const checked = selectedIndustries.includes(industry)
                          return (
                            <label
                              key={industry}
                              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                                checked ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleIndustry(industry)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="flex-1">{industry}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsIndustryOpen(false)
                      setIsAvatarOpen((prev) => !prev)
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <UserRound className="h-4 w-4 text-slate-400" />
                    아바타 변경
                  </button>
                  {isAvatarOpen ? (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[304px] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                      <div className="mb-3 text-xs font-semibold text-slate-400">아바타 선택</div>
                      <div className="flex flex-wrap gap-2">
                        {avatarOptions.map((avatar) => {
                          const active = selectedAvatar === avatar
                          return (
                            <button
                              key={avatar}
                              type="button"
                              onClick={() => setSelectedAvatar(active ? "" : avatar)}
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-[20px] transition ${
                                active
                                  ? "border-blue-300 bg-blue-50 shadow-sm"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                              }`}
                              aria-label={`아바타 ${avatar}`}
                            >
                              {avatar}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setSelectedAvatar("")}
                          className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-500 transition hover:bg-white"
                        >
                          기본값
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isPending}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60"
                >
                  {isPending ? "저장 중..." : "프로필 저장"}
                </button>
              </div>
            </div>
            {profileMessage ? <div className="mt-3 text-sm text-slate-500">{profileMessage}</div> : null}
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="내 신규계약"
              value={data.myContracts.length}
              tone="bg-blue-50 text-blue-700"
              icon={<BriefcaseBusiness className="h-5 w-5" />}
            />
            <MetricCard
              title="내 미회수 계약서"
              value={pendingDocuments.length}
              tone="bg-emerald-50 text-emerald-700"
              icon={<FolderClock className="h-5 w-5" />}
            />
            <MetricCard
              title="나의 해지 리스트"
              value={data.myTerminationRows.length}
              tone="bg-orange-50 text-orange-700"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <MetricCard
              title="나의 청구보류 리스트"
              value={data.myHoldRows.length}
              tone="bg-amber-50 text-amber-700"
              icon={<Landmark className="h-5 w-5" />}
            />
          </section>

          <section className="space-y-5">
            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">1. 내 신규계약 리스트</h3>
                  <p className="mt-1 text-sm text-slate-500">이름 기준으로 등록된 신규계약을 월별 흐름까지 함께 보여줍니다.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
                  총 {data.myContracts.length}건
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.myContractMonthlySummary.length ? (
                  data.myContractMonthlySummary.map((item) => (
                    <div key={item.month} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm font-bold text-slate-900">{item.month}</div>
                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div className="text-[28px] font-black tracking-[-0.04em] text-slate-950">{item.total}</div>
                        <div className="text-right text-xs text-slate-500">
                          <div>미회수 {item.pending}</div>
                          <div>회수 {item.recovered}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-400">
                    등록된 신규계약이 없습니다.
                  </div>
                )}
              </div>

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "부서", "ID", "업종", "계약월", "계약서 상태"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myContracts.length ? (
                      data.myContracts.slice(0, 40).map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.idCode)}</td>
                          <td className="px-4 py-3">{formatValue(row.industryGroup || row.industry)}</td>
                          <td className="px-4 py-3">{formatValue(row.contractMonth)}</td>
                          <td className="px-4 py-3">{formatValue(row.documentStatus)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          등록된 신규계약이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">2. 내 이름으로 된 계약서 미회수 현황</h3>
                  <p className="mt-1 text-sm text-slate-500">선택한 담당 업종 기준으로 미회수 계약서만 모아 보여줍니다.</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  {pendingDocuments.length}건
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {selectedIndustryLabels.length ? (
                  selectedIndustryLabels.map((industry) => (
                    <span key={industry} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {industry}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">담당 업종 미지정</span>
                )}
              </div>

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["회사명", "부서", "ID", "업종", "청구월", "상태"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingDocuments.length ? (
                      pendingDocuments.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.idCode)}</td>
                          <td className="px-4 py-3">{formatValue(row.industryGroup || row.industry)}</td>
                          <td className="px-4 py-3">{formatValue(row.claimMonth)}</td>
                          <td className="px-4 py-3">{formatValue(row.status)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          {selectedIndustryLabels.length ? "미회수 계약서가 없습니다." : "담당 업종을 선택해주세요."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">3. 나의 해지 리스트</h3>
                  <p className="mt-1 text-sm text-slate-500">해지 진행과 해지 확정 건을 구분해서 보여줍니다.</p>
                </div>
                <div className="rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                  {data.myTerminationRows.length}건
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["구분", "고객사", "부서", "고객번호", "사유", "해지일"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myTerminationRows.length ? (
                      data.myTerminationRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
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
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          배정된 해지 리스트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={cardClass}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[22px] font-black tracking-[-0.04em] text-slate-950">4. 나의 청구보류 리스트</h3>
                  <p className="mt-1 text-sm text-slate-500">현재 내 이름으로 관리 중인 청구보류 건을 따로 모았습니다.</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                  {data.myHoldRows.length}건
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["구분", "고객사", "부서", "고객번호", "사유", "처리일"].map((head) => (
                        <th key={head} className="px-4 py-3 text-left font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.myHoldRows.length ? (
                      data.myHoldRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${terminationBadgeClass(row.sectionLabel)}`}>
                              {row.sectionLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">{formatValue(row.companyName)}</td>
                          <td className="px-4 py-3">{formatValue(row.departmentName)}</td>
                          <td className="px-4 py-3">{formatValue(row.customerId)}</td>
                          <td className="px-4 py-3">{formatValue(row.reason)}</td>
                          <td className="px-4 py-3">{formatValue(row.terminationDate || row.receivedDate)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                          배정된 청구보류 리스트가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
