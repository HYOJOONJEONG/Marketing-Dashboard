import { Sidebar } from "@/components/sidebar";
import { KpiCard } from "@/components/kpi-card";
import { ValidationItem } from "@/components/validation-item";
import { Panel } from "@/components/panel";

const kpiData = [
  { label: "주간 순증 매출", value: "61.6M", subText: "전주 대비 +8.4M", trend: "positive" as const },
  { label: "연간 누적 매출", value: "38.2B", subText: "자동 계산 문구 생성", trend: "neutral" as const },
  { label: "주간 신규 계약", value: "16대", subText: "원장 기준 자동 집계", trend: "neutral" as const },
  { label: "주간 해지", value: "6대", subText: "사유별 검증 필요", trend: "negative" as const },
  { label: "누적 순증", value: "97대", subText: "목표 대비 -163대", trend: "neutral" as const },
  { label: "총 계약 대수", value: "6,201", subText: "확정 보고 기준", trend: "neutral" as const },
];

const contractData = [
  { company: "한국투자증권", dept: "크레딧채권운용부", id: "E250658", industry: "국내증권", month: "2026-04", manager: "정진영" },
  { company: "신한라이프생명보험", dept: "특별계정운용팀", id: "E260001", industry: "보험사", month: "2026-04", manager: "박혜리" },
  { company: "영원무역", dept: "수출영업팀", id: "E250674", industry: "일반기업", month: "2026-04", manager: "이홍민" },
  { company: "하나증권", dept: "글로벌마켓운용실", id: "E250665", industry: "국내증권", month: "2026-05", manager: "신무길" },
];

const validationData = [
  { title: "해지 사유 합계와 해지 총계가 일치합니다.", description: "주간 해지 6대, 사유 합계 6대", status: "pass" as const },
  { title: "업종별 신규 합계와 원장 집계가 1건 차이납니다.", description: "원장 178건, 보고 입력 177건", status: "fail" as const },
  { title: "계약서 회수 상태가 미입력인 계약 4건이 있습니다.", description: "원장 화면에서 바로 수정 가능", status: "warn" as const },
];

const managerStats = [
  { name: "신무길", count: 31, percent: "29%" },
  { name: "이상철", count: 19, percent: "18%" },
  { name: "박혜리", count: 15, percent: "14%" },
  { name: "정진영", count: 10, percent: "9%" },
];

const statusStats = [
  { label: "주간 보고 입력 탭 완료", value: "7/7" },
  { label: "신규 계약 원장 누적 건수", value: "107건" },
  { label: "유료 옵션 총 건수", value: "506건" },
  { label: "추가 매출 등록 건수", value: "3건" },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-7">
        {/* Hero Section */}
        <section className="flex justify-between gap-5 p-6 rounded-[28px] bg-gradient-to-br from-card/95 to-secondary/90 border border-border shadow-lg">
          <div>
            <h2 className="text-3xl font-bold mb-2 text-foreground">2026년 12주차 주간실적 보고</h2>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              엑셀 수작업을 웹 입력, 자동 집계, 검증, PDF 출력으로 바꾸는 구조를 기준으로 만든 대시보드입니다. 
              현재 주차의 실적 현황과 보고 준비 상태를 한 화면에서 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end content-start">
            <Chip>기준일 2026-03-20</Chip>
            <Chip>상태 Draft</Chip>
            <Chip>검증 2건 필요</Chip>
            <Chip>PDF 마지막 생성 10:40</Chip>
          </div>
        </section>

        {/* KPI Cards Section */}
        <section className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-foreground">핵심 KPI</h3>
            <p className="text-sm text-muted-foreground">주간 보고서 상단 요약 카드</p>
          </div>
          <div className="grid grid-cols-6 gap-4">
            {kpiData.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
        </section>

        {/* Contract & Status Section */}
        <section className="mt-6 grid grid-cols-[1.3fr_0.9fr] gap-4">
          <Panel title="신규 계약 원장 미리보기">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">회사명</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">부서</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">ID</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">업종</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">계약월</th>
                    <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">권유자</th>
                  </tr>
                </thead>
                <tbody>
                  {contractData.map((row) => (
                    <tr key={row.id} className="border-b border-border/70 last:border-0">
                      <td className="py-3 px-3 text-foreground">{row.company}</td>
                      <td className="py-3 px-3 text-foreground">{row.dept}</td>
                      <td className="py-3 px-3 text-foreground">{row.id}</td>
                      <td className="py-3 px-3 text-foreground">{row.industry}</td>
                      <td className="py-3 px-3 text-foreground">{row.month}</td>
                      <td className="py-3 px-3 text-foreground">{row.manager}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="입력 현황 요약">
            <div className="grid grid-cols-2 gap-4">
              {statusStats.map((stat) => (
                <div key={stat.label} className="p-4 rounded-2xl bg-secondary border border-border">
                  <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        {/* Validation & Manager Stats Section */}
        <section className="mt-6 grid grid-cols-[1.3fr_0.9fr] gap-4">
          <Panel title="검증 센터 미리보기">
            <div className="flex flex-col gap-3">
              {validationData.map((item, i) => (
                <ValidationItem key={i} {...item} />
              ))}
            </div>
          </Panel>

          <Panel title="권유자별 실적 요약">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">권유자</th>
                  <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">건수</th>
                  <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">비중</th>
                </tr>
              </thead>
              <tbody>
                {managerStats.map((row) => (
                  <tr key={row.name} className="border-b border-border/70 last:border-0">
                    <td className="py-3 px-3 text-foreground">{row.name}</td>
                    <td className="py-3 px-3 text-foreground">{row.count}</td>
                    <td className="py-3 px-3 text-foreground">{row.percent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </section>

        {/* Report Preview Section */}
        <section className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-foreground">보고서 / PDF 미리보기</h3>
            <p className="text-sm text-muted-foreground">엑셀 전면 보고서가 웹 화면과 PDF로 재구성되는 영역</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="min-h-[260px] rounded-[22px] border border-dashed border-border bg-gradient-to-b from-card/90 to-secondary/90 p-5">
              <h5 className="text-lg font-semibold mb-3 text-foreground">웹 보고서</h5>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                상단 KPI, 계약 리스트, 목표 실적, 옵션 현황, 해지 현황, 업종별 실적을 카드와 테이블로 구성합니다.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                실무자는 여기서 최종 검토 후 PDF 생성 버튼을 누르게 됩니다.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                검증 오류가 남아 있으면 생성 전 경고를 표시합니다.
              </p>
            </div>
            <div className="min-h-[260px] rounded-[22px] border border-dashed border-border bg-gradient-to-b from-card/90 to-secondary/90 p-5">
              <h5 className="text-lg font-semibold mb-3 text-foreground">PDF 출력본</h5>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                현재 엑셀 보고 양식의 익숙한 흐름은 유지하되, 데이터는 모두 DB에서 읽어 렌더링합니다.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                생성 시점 데이터를 스냅샷으로 저장해 같은 주차의 과거 보고서를 다시 꺼낼 수 있습니다.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                보고서 확정 후에는 잠금 상태로 전환할 수 있습니다.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 rounded-full bg-card/80 border border-border text-sm text-muted-foreground">
      {children}
    </div>
  );
}
