import React from "react"
import { OptionRecord, OptionCategory } from "../../hooks/use-option-dashboard-data"

type Props = {
  records: OptionRecord[]
  categories: OptionCategory[]
  search: string
  selectedCategoryCode: string
  onSearchChange: (value: string) => void
  onSaveRecord: (record: OptionRecord) => Promise<void>
  onDeleteRecord: (recordId: string) => Promise<void>
}

const tableBaseClass = "w-full table-fixed text-[12px]"
const thClass =
  "border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11.5px] font-semibold text-slate-600 whitespace-nowrap"
const tdClass = "border-t border-slate-200 px-2 py-1.5 text-center text-[12px] text-slate-800"
const inputClass = "h-8 w-full rounded-md border border-slate-200/80 bg-white/90 px-2 text-[12px]"
const labelClass = "mb-1 text-[11px] font-semibold text-slate-600"

export function OptionDetailTable({
  records,
  categories,
  search,
  selectedCategoryCode,
  onSearchChange,
  onSaveRecord,
  onDeleteRecord,
}: Props) {
  type ColumnDef = {
    key: string
    label: string
    headerClass?: string
    cellClass?: string
    valueClass?: string
  }

  const [sortKey, setSortKey] = React.useState<string>("category_name_ko")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<OptionRecord | null>(null)
  const [newRecord, setNewRecord] = React.useState<OptionRecord | null>(null)
  const [expandedNoteIds, setExpandedNoteIds] = React.useState<Set<string>>(new Set())

  const industryOptions = React.useMemo(
    () => [
      "국내증권",
      "국내은행",
      "외국계",
      "자산운용",
      "보험사",
      "일반기업",
      "공사/정부",
      "연기금",
      "기타금융",
    ],
    [],
  )

  const normalizeIndustry = React.useCallback(
    (value: unknown) => {
      const text = String(value ?? "").trim()
      if (!text) return ""
      if (text.includes("국내증권") || text.includes("증권")) return "국내증권"
      if (text.includes("외국계")) return "외국계"
      if (text.includes("국내은행") || (text.includes("은행") && !text.includes("외국계"))) return "국내은행"
      if (text.includes("자산운용")) return "자산운용"
      if (text.includes("보험")) return "보험사"
      if (text.includes("일반기업")) return "일반기업"
      if (text.includes("연기금")) return "연기금"
      if (text.includes("공제회")) return "연기금"
      if (text.includes("공사") || text.includes("정부") || text.includes("공공기관")) return "공사/정부"
      if (text.includes("중개") || text.includes("평가")) return "기타금융"
      if (text.includes("기타금융")) return "기타금융"
      return "기타금융"
    },
    [],
  )

  const categoryOptions = categories.map((cat) => ({
    value: cat.category_code,
    label: cat.category_name_ko,
  }))

  const isBondView = selectedCategoryCode === "BOND"
  const isSignageView = selectedCategoryCode === "SIGNAGE"
  const tableClass = tableBaseClass
  const actionColumnClass = isSignageView
    ? "w-[92px] px-1 py-1.5 text-[11px] whitespace-nowrap text-center leading-tight"
    : isBondView
      ? "w-[92px] px-1 py-1.5 text-[11px] whitespace-nowrap text-center leading-tight"
      : "w-[104px] px-1 py-1.5 text-[11px] whitespace-nowrap text-center leading-tight"
  const actionButtonClass =
    "inline-flex h-7 min-w-[28px] items-center justify-center whitespace-nowrap rounded-md border px-1 text-[11px] font-semibold leading-none transition"

  React.useEffect(() => {
    if (!newRecord && categoryOptions.length) {
      const fallback = categoryOptions[0]
      setNewRecord({
        record_id: `record-${Date.now()}`,
        category_code: fallback?.value || "",
        category_name_ko: fallback?.label || "",
        sub_type: "",
        industry: "",
        company_name: "",
        user_id: "",
        department: "",
        requester_name: "",
        contact: "",
        request_date: "",
        real_apply: "",
        billing_month: "",
        status: "",
        agreement: "",
        customer_type: "",
        tr_cd: "",
        dedicated: "",
        quantity: "",
        recommender: "",
        receiver: "",
        apply_count: "",
        apply_ids: "",
        amount: "",
        note: "",
        is_active: 1,
      })
    }
  }, [categoryOptions, newRecord])

  React.useEffect(() => {
    if (!newRecord) return
    if (selectedCategoryCode && selectedCategoryCode !== "all") {
      const found = categoryOptions.find((option) => option.value === selectedCategoryCode)
      if (found && newRecord.category_code !== found.value) {
        setNewRecord({ ...newRecord, category_code: found.value, category_name_ko: found.label })
      }
    }
  }, [selectedCategoryCode, categoryOptions, newRecord])

  const columns: Array<ColumnDef> = isBondView
    ? [
        { key: "row_no", label: "NO", headerClass: "w-[4%]", cellClass: "whitespace-nowrap text-center" },
        { key: "sub_type", label: "업종", headerClass: "w-[8%]", cellClass: "whitespace-nowrap text-center" },
        { key: "user_id", label: "아이디", headerClass: "w-[10%]", cellClass: "whitespace-nowrap" },
        { key: "company_name", label: "기관", headerClass: "w-[14%]", cellClass: "whitespace-normal break-all leading-4" },
        { key: "department", label: "부서", headerClass: "w-[12%]", cellClass: "whitespace-normal break-all leading-4" },
        { key: "billing_month", label: "청구월", headerClass: "w-[7%]", cellClass: "whitespace-nowrap text-center" },
        { key: "dedicated", label: "전용여부", headerClass: "w-[7%]", cellClass: "whitespace-nowrap text-center" },
        { key: "quantity", label: "수량", headerClass: "w-[5%]", cellClass: "whitespace-nowrap text-center" },
        { key: "recommender", label: "권유자", headerClass: "w-[7%]", cellClass: "whitespace-nowrap text-center" },
        {
          key: "note",
          label: "비고",
          headerClass: "w-[14%]",
          cellClass: "whitespace-normal break-words align-middle",
          valueClass: "leading-4",
        },
      ]
    : isSignageView
      ? [
          { key: "row_no", label: "NO", headerClass: "w-[4%]", cellClass: "whitespace-nowrap text-center" },
          { key: "sub_type", label: "업종", headerClass: "w-[7%]", cellClass: "whitespace-normal break-all" },
          { key: "company_name", label: "회사명", headerClass: "w-[12%]", cellClass: "whitespace-normal break-all" },
          { key: "user_id", label: "사용자ID", headerClass: "w-[12%]", cellClass: "whitespace-normal break-all" },
          { key: "department", label: "부서", headerClass: "w-[16%]", cellClass: "whitespace-normal break-all" },
          { key: "billing_month", label: "청구월", headerClass: "w-[10%]", cellClass: "whitespace-normal break-all" },
          { key: "status", label: "상태", headerClass: "w-[7%]", cellClass: "whitespace-nowrap text-center" },
          {
            key: "note",
            label: "비고",
            headerClass: "w-[13%]",
            cellClass: "whitespace-normal break-all align-middle",
            valueClass: "leading-4",
          },
        ]
      : [
          { key: "row_no", label: "NO", headerClass: "w-14", cellClass: "whitespace-nowrap text-center" },
          { key: "sub_type", label: "업종", headerClass: "w-28", cellClass: "whitespace-nowrap" },
          { key: "company_name", label: "회사명", headerClass: "w-36", cellClass: "whitespace-nowrap" },
          { key: "user_id", label: "사용자ID", headerClass: "w-36", cellClass: "whitespace-nowrap" },
          { key: "department", label: "부서", headerClass: "w-36", cellClass: "whitespace-nowrap" },
          { key: "billing_month", label: "청구월", headerClass: "w-28", cellClass: "whitespace-nowrap" },
          { key: "status", label: "상태", headerClass: "w-24", cellClass: "whitespace-nowrap text-center" },
          {
            key: "note",
            label: "비고",
            headerClass: "min-w-[280px]",
            cellClass: "whitespace-normal break-words align-middle",
            valueClass: "leading-5",
          },
        ]

  const sortedRecords = React.useMemo(() => {
    const list = [...records]
    list.sort((a, b) => {
      const left = (a as any)[sortKey] ?? ""
      const right = (b as any)[sortKey] ?? ""
      const leftNum = Number(String(left).replace(/[^0-9.-]/g, ""))
      const rightNum = Number(String(right).replace(/[^0-9.-]/g, ""))
      if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum)) {
        return sortDir === "asc" ? leftNum - rightNum : rightNum - leftNum
      }
      const text = String(left).localeCompare(String(right))
      return sortDir === "asc" ? text : -text
    })
    return list
  }, [records, sortKey, sortDir])

  const duplicateBondUserIds = React.useMemo(() => {
    if (!isBondView) return new Set<string>()
    const counts = new Map<string, number>()
    records.forEach((record) => {
      if (record.category_code !== "BOND") return
      const userId = String(record.user_id ?? "").trim()
      if (!userId) return
      counts.set(userId, (counts.get(userId) ?? 0) + 1)
    })
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([userId]) => userId))
  }, [isBondView, records])

  const getRecordRowKey = React.useCallback((record: OptionRecord, index: number) => {
    return record.record_id || `${record.category_code}-${record.user_id}-${record.company_name}-${index}`
  }, [])

  const visibleSignageNoteIds = React.useMemo(() => {
    if (!isSignageView) return []
    return sortedRecords
      .map((record, index) => ({
        id: getRecordRowKey(record, index),
        note: String(record.note ?? "").trim(),
      }))
      .filter((item) => item.note.length > 0)
      .map((item) => item.id)
  }, [getRecordRowKey, isSignageView, sortedRecords])

  const allSignageNotesExpanded =
    visibleSignageNoteIds.length > 0 && visibleSignageNoteIds.every((id) => expandedNoteIds.has(id))

  const toggleExpandedNote = React.useCallback((id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllSignageNotes = React.useCallback(() => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev)
      if (allSignageNotesExpanded) {
        visibleSignageNoteIds.forEach((id) => next.delete(id))
      } else {
        visibleSignageNoteIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [allSignageNotesExpanded, visibleSignageNoteIds])

  const startEdit = (record: OptionRecord) => {
    setEditingId(record.record_id || null)
    setDraft({ ...record })
  }

  const startCreate = () => {
    const recordId = `record-${Date.now()}`
    setEditingId(recordId)
    setDraft({
      record_id: recordId,
      category_code: categoryOptions[0]?.value || "BOND",
      category_name_ko: categoryOptions[0]?.label || "해외채권",
      sub_type: "",
      industry: "",
      company_name: "",
      user_id: "",
      department: "",
      requester_name: "",
      contact: "",
      request_date: "",
      real_apply: "",
      billing_month: "",
      status: "",
      agreement: "",
      customer_type: "",
      tr_cd: "",
      dedicated: "",
      quantity: "",
      recommender: "",
      receiver: "",
      apply_count: "",
      apply_ids: "",
      amount: "",
      note: "",
      is_active: 1,
    })
  }

  const handleDraftChange = (key: keyof OptionRecord, value: string) => {
    if (!draft) return
    const next = { ...draft, [key]: value }
    if (key === "category_code") {
      const found = categoryOptions.find((option) => option.value === value)
      next.category_name_ko = found?.label || next.category_name_ko
    }
    setDraft(next)
  }

  const handleNewChange = (key: keyof OptionRecord, value: string) => {
    if (!newRecord) return
    const next = { ...newRecord, [key]: value }
    if (key === "category_code") {
      const found = categoryOptions.find((option) => option.value === value)
      next.category_name_ko = found?.label || next.category_name_ko
    }
    setNewRecord(next)
  }

  const handleCreate = async () => {
    if (!newRecord) return
    if (!newRecord.category_code) return
    try {
      await onSaveRecord(newRecord)
      setNewRecord({
        ...newRecord,
        record_id: `record-${Date.now()}`,
        sub_type: "",
        company_name: "",
        user_id: "",
        department: "",
        requester_name: "",
        billing_month: "",
        status: "",
        note: "",
      })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "옵션 저장에 실패했습니다.")
    }
  }

  const handleSave = async () => {
    if (!draft) return
    try {
      await onSaveRecord(draft)
      setEditingId(null)
      setDraft(null)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "옵션 저장에 실패했습니다.")
    }
  }

  const handleDelete = async (recordId?: string) => {
    if (!recordId) return
    try {
      await onDeleteRecord(recordId)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "옵션 삭제에 실패했습니다.")
    }
  }

  const renderInput = (key: keyof OptionRecord) => {
    if (!draft) return null
    const value = (draft as any)[key] ?? ""
    if (key === "sub_type") {
      const normalized = normalizeIndustry(draft.sub_type)
      return (
        <select
          value={normalized || draft.sub_type || ""}
          onChange={(event) => handleDraftChange("sub_type", event.target.value)}
          className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
        >
          <option value="">업종 선택</option>
          {industryOptions.map((option) => (
            <option key={`industry-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }
    if (key === "category_code" || key === "category_name_ko") {
      return (
        <select
          value={draft.category_code}
          onChange={(event) => handleDraftChange("category_code", event.target.value)}
          className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }
    if (key === "note") {
      return (
        <textarea
          value={value}
          onChange={(event) => handleDraftChange(key, event.target.value)}
          className="min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12px] leading-4"
        />
      )
    }
    return (
      <input
        value={value}
        onChange={(event) => handleDraftChange(key, event.target.value)}
        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px]"
      />
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[15px] font-bold text-slate-900">상세 목록</div>
          <span className="text-[12px] text-slate-500">{records.length}건</span>
          {isBondView && duplicateBondUserIds.size > 0 && (
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              중복 ID {duplicateBondUserIds.size}개
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSignageView && visibleSignageNoteIds.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSignageNotes}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              {allSignageNotesExpanded ? "비고 전체 접기" : "비고 전체 펼치기"}
            </button>
          )}
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="검색: 회사명, 사용자ID"
            className="h-9 w-48 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="mb-3 text-[13px] font-semibold text-slate-700">옵션 정보 입력</div>
        {isBondView ? (
          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-2">
              <div className={labelClass}>업종 선택</div>
              <select value={newRecord?.sub_type || ""} onChange={(event) => handleNewChange("sub_type", event.target.value)} className={inputClass}>
                <option value="">업종 선택</option>
                {industryOptions.map((option) => (
                  <option key={`new-industry-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <div className={labelClass}>아이디</div>
              <input value={newRecord?.user_id || ""} onChange={(event) => handleNewChange("user_id", event.target.value)} placeholder="아이디" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>기관</div>
              <input value={newRecord?.company_name || ""} onChange={(event) => handleNewChange("company_name", event.target.value)} placeholder="기관" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>부서</div>
              <input value={newRecord?.department || ""} onChange={(event) => handleNewChange("department", event.target.value)} placeholder="부서" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>청구월</div>
              <input value={newRecord?.billing_month || ""} onChange={(event) => handleNewChange("billing_month", event.target.value)} placeholder="청구월" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>전용여부</div>
              <input value={newRecord?.dedicated || ""} onChange={(event) => handleNewChange("dedicated", event.target.value)} placeholder="전용여부" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>수량</div>
              <input value={newRecord?.quantity || ""} onChange={(event) => handleNewChange("quantity", event.target.value)} placeholder="수량" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>권유자</div>
              <input value={newRecord?.recommender || ""} onChange={(event) => handleNewChange("recommender", event.target.value)} placeholder="권유자" className={inputClass} />
            </div>
            <div className="col-span-6">
              <div className={labelClass}>비고</div>
              <input value={newRecord?.note || ""} onChange={(event) => handleNewChange("note", event.target.value)} placeholder="비고" className={inputClass} />
            </div>
            <div className="col-span-2 flex items-end justify-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={selectedCategoryCode.length === 0}
                className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-4 text-[12px] font-semibold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                등록
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-2.5">
            <div className="col-span-2">
              <div className={labelClass}>업종</div>
              <select value={newRecord?.sub_type || ""} onChange={(event) => handleNewChange("sub_type", event.target.value)} className={inputClass}>
                <option value="">업종 선택</option>
                {industryOptions.map((option) => (
                  <option key={`new-industry-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <div className={labelClass}>회사명</div>
              <input value={newRecord?.company_name || ""} onChange={(event) => handleNewChange("company_name", event.target.value)} placeholder="회사명" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>사용자ID</div>
              <input value={newRecord?.user_id || ""} onChange={(event) => handleNewChange("user_id", event.target.value)} placeholder="사용자ID" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>부서</div>
              <input value={newRecord?.department || ""} onChange={(event) => handleNewChange("department", event.target.value)} placeholder="부서" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>청구월</div>
              <input value={newRecord?.billing_month || ""} onChange={(event) => handleNewChange("billing_month", event.target.value)} placeholder="청구월" className={inputClass} />
            </div>
            <div className="col-span-2">
              <div className={labelClass}>상태</div>
              <input value={newRecord?.status || ""} onChange={(event) => handleNewChange("status", event.target.value)} placeholder="상태" className={inputClass} />
            </div>
            <div className="col-span-8">
              <div className={labelClass}>비고</div>
              <input value={newRecord?.note || ""} onChange={(event) => handleNewChange("note", event.target.value)} placeholder="비고" className={inputClass} />
            </div>
            <div className="col-span-2 flex items-end justify-end">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!selectedCategoryCode || selectedCategoryCode === "all"}
                className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-4 text-[12px] font-semibold text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                등록
              </button>
            </div>
          </div>
        )}
        {(!selectedCategoryCode || selectedCategoryCode === "all") && (
          <div className="mt-2 text-[11px] text-slate-500">상단 카드에서 옵션을 먼저 선택해 주세요.</div>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className={tableClass}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${thClass} ${column.headerClass || ""} ${
                    isSignageView
                      ? "px-2 py-1.5 text-[11px] whitespace-normal break-all text-center leading-tight"
                      : isBondView
                        ? "px-2 py-1.5 text-[11px] whitespace-normal break-all text-center leading-tight"
                        : ""
                  }`}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => {
                      if (sortKey === column.key) {
                        setSortDir(sortDir === "asc" ? "desc" : "asc")
                      } else {
                        setSortKey(column.key)
                        setSortDir("asc")
                      }
                    }}
                  >
                    {column.label}
                    {sortKey === column.key && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </button>
                </th>
              ))}
              <th className={`${thClass} ${actionColumnClass}`}>
                작업
              </th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-[13px] text-slate-500">
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              sortedRecords.map((row, index) => {
                const isEditing = editingId && row.record_id === editingId
                const rowKey = getRecordRowKey(row, index)
                const rowUserId = String(row.user_id ?? "").trim()
                const isDuplicateBondUserId = isBondView && duplicateBondUserIds.has(rowUserId)
                return (
                  <tr key={row.record_id || `${row.user_id}-${index}`} className={isDuplicateBondUserId ? "bg-rose-50/70" : undefined}>
                    {columns.map((column) => {
                      const value =
                        column.key === "row_no"
                          ? index + 1
                          : column.key === "sub_type"
                            ? normalizeIndustry((row as any)[column.key])
                            : (row as any)[column.key]
                      const cellClass = `${tdClass} ${column.cellClass || "whitespace-nowrap"} ${
                        isSignageView ? "px-2 py-1.5 text-[11.5px]" : isBondView ? "px-2 py-1.5 text-[11.5px]" : ""
                      } ${
                        isDuplicateBondUserId && column.key === "user_id"
                          ? "bg-rose-100 font-bold text-rose-700 ring-1 ring-inset ring-rose-200"
                          : ""
                      }`
                      if (isEditing && draft) {
                        const editKey = column.key as keyof OptionRecord
                        if (column.key === "row_no") {
                          return (
                            <td key={column.key} className={cellClass}>
                              {index + 1}
                            </td>
                          )
                        }
                        return (
                          <td key={column.key} className={cellClass}>
                            {renderInput(editKey)}
                          </td>
                        )
                      }
                      if (column.key === "row_no") {
                        return (
                          <td key={column.key} className={cellClass}>
                            {index + 1}
                          </td>
                        )
                      }
                      return (
                        <td key={column.key} className={cellClass}>
                          {column.key === "note" ? (
                            (() => {
                              const noteText = String(value ?? "")
                              const isExpandableNote = isSignageView && noteText.trim().length > 0
                              const isExpanded = isExpandableNote && expandedNoteIds.has(rowKey)
                              return (
                                <div
                                  className={`flex flex-col justify-center gap-1 text-center ${
                                    isSignageView ? "min-h-[44px]" : "min-h-0"
                                  } ${
                                    isExpanded ? "items-stretch" : "items-center"
                                  }`}
                                >
                                  <div
                                    className={`${column.valueClass || ""} whitespace-pre-wrap break-all ${isExpanded ? "text-left" : ""}`}
                                    title={noteText}
                                    style={
                                      isExpanded
                                        ? undefined
                                        : {
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                          }
                                    }
                                  >
                                    {noteText}
                                  </div>
                                  {isExpandableNote && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandedNote(rowKey)}
                                      className="mx-auto rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                      {isExpanded ? "접기" : "펼치기"}
                                    </button>
                                  )}
                                </div>
                              )
                            })()
                          ) : (
                            <div className={column.valueClass || ""}>{value}</div>
                          )}
                        </td>
                      )
                    })}
                    <td
                      className={`${tdClass} whitespace-nowrap px-1.5 py-1.5 text-center align-middle`}
                    >
                      {isEditing ? (
                        <div
                          className="mx-auto flex w-fit flex-nowrap items-center justify-center gap-1"
                        >
                          <button
                            type="button"
                            className={`${actionButtonClass} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
                            onClick={handleSave}
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            className={`${actionButtonClass} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                            onClick={() => {
                              setEditingId(null)
                              setDraft(null)
                            }}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            className={`${actionButtonClass} border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100`}
                            onClick={() => handleDelete(row.record_id)}
                          >
                            삭제
                          </button>
                        </div>
                      ) : (
                        <div
                          className="mx-auto flex w-fit flex-nowrap items-center justify-center gap-1"
                        >
                          <button
                            type="button"
                            className={`${actionButtonClass} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                            onClick={() => startEdit(row)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className={`${actionButtonClass} border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100`}
                            onClick={() => handleDelete(row.record_id)}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
