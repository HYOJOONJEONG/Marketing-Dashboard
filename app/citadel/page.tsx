"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ArrowLeft, CalendarDays, ChevronDown, Download, Filter, Search } from "lucide-react"

type TabKey = "intraday" | "holdings" | "slb"

const tabs: { key: TabKey; label: string }[] = [
  { key: "intraday", label: "Intraday Flow" },
  { key: "holdings", label: "Investor Holdings" },
  { key: "slb", label: "SLB / Repo" },
]

const treeItems = [
  "KTB Universe",
  "KTB 3Y",
  "KTB 5Y",
  "KTB 10Y",
  "KTB 20Y",
  "KTB 30Y",
  "Monetary Stabilization Bonds",
  "Government-Sponsored Bonds",
]

const investorOptions = ["Banks", "Securities", "Insurance", "Pension Funds", "Foreigners", "Retail"]

const intradayFlowData = [
  { time: "09:00", pension: 0, foreign: 0, banks: 0 },
  { time: "10:00", pension: 5, foreign: -2, banks: 8 },
  { time: "11:00", pension: 12, foreign: -5, banks: 15 },
  { time: "12:00", pension: 20, foreign: -8, banks: 22 },
  { time: "13:00", pension: 35, foreign: -15, banks: 25 },
  { time: "14:00", pension: 42, foreign: -22, banks: 28 },
  { time: "15:00", pension: 45, foreign: -30, banks: 30 },
]

const volumeData = [
  { time: "09:00", volume: 50, yield: 2.83 },
  { time: "10:00", volume: 80, yield: 2.84 },
  { time: "11:00", volume: 120, yield: 2.86 },
  { time: "12:00", volume: 100, yield: 2.85 },
  { time: "13:00", volume: 150, yield: 2.87 },
  { time: "14:00", volume: 200, yield: 2.88 },
  { time: "15:00", volume: 180, yield: 2.85 },
]

const investorTable = [
  { name: "Banks", buy: 350, sell: 320, net: 30, share: "28%", delta: "+5" },
  { name: "Securities", buy: 280, sell: 290, net: -10, share: "22%", delta: "-2" },
  { name: "Insurance", buy: 220, sell: 210, net: 10, share: "18%", delta: "+3" },
  { name: "Pension Funds", buy: 180, sell: 135, net: 45, share: "14%", delta: "+12" },
  { name: "Foreigners", buy: 120, sell: 150, net: -30, share: "10%", delta: "-8" },
]

const holdingsMix = [
  { name: "Banks", value: 30, color: "#275df5" },
  { name: "Securities", value: 15, color: "#00a7a0" },
  { name: "Insurance", value: 20, color: "#f3a712" },
  { name: "Pension Funds", value: 25, color: "#1141b2" },
  { name: "Foreigners", value: 10, color: "#e35d5b" },
]

const maturityData = [
  { bucket: "3Y", total: 12000, foreign: 1500 },
  { bucket: "5Y", total: 15000, foreign: 1875 },
  { bucket: "10Y", total: 18200, foreign: 2275 },
]

const holdingsTable = [
  { bucket: "3Y", total: "12,000", banks: "3,600", securities: "1,200", insurance: "1,800", pension: "3,000", foreign: "1,500", foreignRatio: "12.5" },
  { bucket: "5Y", total: "15,000", banks: "4,500", securities: "1,500", insurance: "2,250", pension: "3,750", foreign: "1,875", foreignRatio: "12.5" },
  { bucket: "10Y", total: "18,200", banks: "5,460", securities: "1,820", insurance: "2,730", pension: "4,550", foreign: "2,275", foreignRatio: "12.5" },
]

const slbTrendData = [
  { date: "Mar 20", balance: 2200 },
  { date: "Mar 21", balance: 2350 },
  { date: "Mar 24", balance: 2400 },
  { date: "Mar 25", balance: 2450 },
  { date: "Mar 26", balance: 2500 },
]

const repoSummary = [
  { name: "Securities A", newBorrow: 500, return: 300, net: 200, balance: 800, rate: "2.1%" },
  { name: "Securities B", newBorrow: 400, return: 450, net: -50, balance: 1200, rate: "2.3%" },
  { name: "Bank C", newBorrow: 300, return: 250, net: 50, balance: 500, rate: "1.9%" },
]

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ")
}

function numberClass(value: number) {
  if (value > 0) return "text-emerald-600"
  if (value < 0) return "text-rose-600"
  return "text-slate-500"
}

function formatBillions(value: number) {
  return `${value.toLocaleString("en-US")} bn`
}

function YonhapInfomaxLogo() {
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="yonhap-blue" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2f71ff" />
            <stop offset="100%" stopColor="#0f4acb" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill="url(#yonhap-blue)" />
        <path
          d="M23 14c7 3 14 12 14 20 0 9-7 17-16 17-4 0-8-2-11-5 4 1 7 2 10 2 7 0 12-5 12-12 0-6-3-11-9-16zm18 1c5 4 8 9 8 16 0 11-9 20-20 20-4 0-7-1-10-2 2 0 4 1 6 1 10 0 18-7 18-17 0-6-2-11-7-18z"
          fill="#fff"
          opacity="0.96"
        />
      </svg>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-blue-100/85">Data Partner</div>
        <div className="text-lg font-black tracking-[-0.03em] text-white">YONHAP INFOMAX</div>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_22px_80px_rgba(15,23,42,0.06)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-[-0.03em] text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabKey>("intraday")
  const [activeTree, setActiveTree] = useState("KTB Universe")

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#d7e5ff_0%,_#eff4fb_28%,_#f5f7fb_58%,_#f7f9fc_100%)] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketing Dashboard
          </Link>
        </div>

        <header className="overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#0f2c7d_0%,#1c4ee8_52%,#5ca7ff_100%)] text-white shadow-[0_30px_90px_rgba(17,65,178,0.28)]">
          <div className="border-b border-white/15 px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-4">
                <YonhapInfomaxLogo />
                <div className="max-w-3xl">
                  <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-50">
                    Citadel Fixed Income View
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">
                    Korea Treasury Bond Flow Dashboard
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50/88 sm:text-base">
                    A responsive English-language monitoring surface for intraday flow, holdings concentration, and securities lending color across the KTB curve.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[460px]">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.22em] text-blue-100/80">Reference Date</div>
                  <div className="mt-2 flex items-center gap-2 text-lg font-bold">
                    <CalendarDays className="h-4 w-4" />
                    2026-03-25
                  </div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.22em] text-blue-100/80">Selected ISIN</div>
                  <div className="mt-2 text-lg font-bold">KR101701GA00</div>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <div className="text-xs uppercase tracking-[0.22em] text-blue-100/80">Coverage</div>
                  <div className="mt-2 text-lg font-bold">Govies / SLB / Repo</div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-7">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_0.9fr_1fr_0.9fr_auto_auto]">
              <label className="rounded-2xl border border-white/15 bg-white/95 px-4 py-3 text-left text-slate-900 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <Search className="h-3.5 w-3.5" />
                  ISIN / Security
                </div>
                <input readOnly value="KR101701GA00" className="w-full bg-transparent text-sm font-semibold outline-none" />
              </label>

              <button className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/95 px-4 py-3 text-left text-slate-900 shadow-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Tenor Bucket</div>
                  <div className="mt-2 text-sm font-semibold">All Maturities</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              <button className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/95 px-4 py-3 text-left text-slate-900 shadow-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Investor Type</div>
                  <div className="mt-2 text-sm font-semibold">Banks, Securities, Insurance</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              <label className="rounded-2xl border border-white/15 bg-white/95 px-4 py-3 text-left text-slate-900 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Valuation Date
                </div>
                <input readOnly value="2026-03-25" className="w-full bg-transparent text-sm font-semibold outline-none" />
              </label>

              <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50">
                <Filter className="h-4 w-4" />
                Query
              </button>

              <button className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-[#0cba9e] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0aa58c]">
                <Download className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-slate-200 bg-white/96 p-5 shadow-[0_22px_80px_rgba(15,23,42,0.05)] backdrop-blur">
            <div className="mb-5">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Sector Tree</div>
              <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-slate-900">Curve Navigator</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use the tenor tree to pivot across government bond sectors and isolate pockets of liquidity.
              </p>
            </div>

            <nav className="space-y-2">
              {treeItems.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveTree(item)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition",
                    activeTree === item
                      ? "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(39,93,245,0.18)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <span className={index > 0 && index < 6 ? "pl-4" : ""}>
                    {index > 0 && index < 6 ? `└ ${item.replace("KTB ", "")}` : item}
                  </span>
                  {activeTree === item ? <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> : null}
                </button>
              ))}
            </nav>

            <div className="mt-6 rounded-[24px] bg-slate-950 p-5 text-white">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Preset Investors</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {investorOptions.map((option, index) => (
                  <span
                    key={option}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      index < 5 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-slate-700 text-slate-300",
                    )}
                  >
                    {option}
                  </span>
                ))}
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white/96 p-2 shadow-[0_22px_80px_rgba(15,23,42,0.05)] backdrop-blur">
              <div className="grid gap-2 md:grid-cols-3">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "rounded-[22px] px-4 py-4 text-sm font-bold transition",
                      activeTab === tab.key
                        ? "bg-white text-blue-700 shadow-[0_10px_30px_rgba(39,93,245,0.12)] ring-1 ring-blue-100"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeTab === "intraday" ? <IntradayPanel /> : null}
            {activeTab === "holdings" ? <HoldingsPanel /> : null}
            {activeTab === "slb" ? <SlbPanel /> : null}
          </main>
        </div>
      </div>
    </div>
  )
}

function IntradayPanel() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="Previous Close Yield" value="2.85%" tone="blue" />
        <MetricCard label="Cumulative Turnover" value="1,250 bn" tone="cyan" />
        <MetricCard label="Pension Net Buying" value="+45 bn" tone="emerald" />
        <MetricCard label="YTD Net Buying" value="+2.3%" tone="amber" />
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <SectionCard title="Intraday Net Flow" subtitle="Net buying by major investor type through the trading session.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={intradayFlowData}>
                <defs>
                  <linearGradient id="pensionFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#12b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#12b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="pension" name="Pension Funds" stroke="#12b981" fill="url(#pensionFill)" strokeWidth={3} />
                <Area type="monotone" dataKey="foreign" name="Foreigners" stroke="#ef4444" fillOpacity={0} strokeWidth={3} />
                <Area type="monotone" dataKey="banks" name="Banks" stroke="#275df5" fillOpacity={0} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Volume Profile" subtitle="Executed turnover and indicative yield snapshots by hour.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis type="category" dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} width={54} />
                <Tooltip />
                <Bar dataKey="volume" name="Volume" fill="#4d93ff" radius={[0, 12, 12, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Investor Breakdown" subtitle="Dummy transaction metrics arranged for easy replacement with production data feeds.">
        <DashboardTable
          headers={["Investor", "Buy", "Sell", "Net", "Share", "Vs Prev. Day"]}
          rows={investorTable.map((row) => [
            row.name,
            formatBillions(row.buy),
            formatBillions(row.sell),
            <span key={`${row.name}-net`} className={cn("font-bold", numberClass(row.net))}>
              {row.net > 0 ? `+${row.net}` : row.net} bn
            </span>,
            row.share,
            <span key={`${row.name}-delta`} className={cn("font-semibold", row.delta.startsWith("+") ? "text-emerald-600" : "text-rose-600")}>
              {row.delta}
            </span>,
          ])}
        />
      </SectionCard>
    </div>
  )
}

function HoldingsPanel() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="Total Outstanding" value="50,000 bn" tone="blue" />
        <MetricCard label="Free Float" value="45,200 bn" tone="cyan" />
        <MetricCard label="Foreign Ownership" value="12.5%" tone="rose" />
        <MetricCard label="Pension Share" value="35.2%" tone="emerald" />
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
        <SectionCard title="Holding Mix" subtitle="Investor distribution across the selected KTB line.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={holdingsMix} dataKey="value" nameKey="name" innerRadius={78} outerRadius={112} paddingAngle={3}>
                  {holdingsMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Maturity Distribution" subtitle="Total outstanding versus foreign balance by tenor bucket.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maturityData}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Total Outstanding" fill="#275df5" radius={[10, 10, 0, 0]} />
                <Bar dataKey="foreign" name="Foreign Holdings" fill="#00a7a0" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Tenor Ownership Table" subtitle="Investor holdings template aligned to a desk-ready English presentation format.">
        <DashboardTable
          headers={["Bucket", "Total", "Banks", "Securities", "Insurance", "Pension", "Foreign", "Foreign %"]}
          rows={holdingsTable.map((row) => [
            row.bucket,
            row.total,
            row.banks,
            row.securities,
            row.insurance,
            row.pension,
            row.foreign,
            row.foreignRatio,
          ])}
        />
      </SectionCard>
    </div>
  )
}

function SlbPanel() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <MetricCard label="SLB Balance" value="2,500 bn" tone="amber" />
        <MetricCard label="Pct. of Outstanding" value="5.0%" tone="blue" />
        <MetricCard label="Day-on-Day Change" value="+150 bn" tone="emerald" />
        <MetricCard label="5D Avg. Turnover" value="320 bn" tone="cyan" />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <SectionCard title="SLB Balance Trend" subtitle="Recent lending balance build-up around the selected issue.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={slbTrendData}>
                <defs>
                  <linearGradient id="slbFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#f3a712" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#f3a712" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="balance" name="SLB Balance" stroke="#d99200" fill="url(#slbFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Repo Coverage Note" subtitle="Presentation-safe disclaimer for external counterparties.">
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              <strong className="block text-base font-bold">Repo disclosure</strong>
              KTB repo transactions do not disclose the underlying bond at the single-ISIN level. Only intermediary-level aggregate repo flows should be shown in a separate repo overview page.
            </div>
          </SectionCard>

          <SectionCard title="Desk Snapshot" subtitle="Representative counterparties and lending rates.">
            <div className="space-y-3">
              {repoSummary.map((row) => (
                <div key={row.name} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{row.name}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">Average Rate {row.rate}</div>
                    </div>
                    <div className={cn("text-sm font-bold", numberClass(row.net))}>{row.net > 0 ? `+${row.net}` : row.net} bn</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <div>New {row.newBorrow} bn</div>
                    <div>Return {row.return} bn</div>
                    <div>Bal. {row.balance} bn</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="SLB Counterparty Table" subtitle="Dummy rows structured so production mapping can replace the static dataset with minimal code change.">
        <DashboardTable
          headers={["Counterparty", "New Borrow", "Return", "Net Change", "Balance", "Avg. Rate"]}
          rows={repoSummary.map((row) => [
            row.name,
            `${row.newBorrow} bn`,
            `${row.return} bn`,
            <span key={`${row.name}-net`} className={cn("font-bold", numberClass(row.net))}>
              {row.net > 0 ? `+${row.net}` : row.net} bn
            </span>,
            `${row.balance} bn`,
            row.rate,
          ])}
        />
      </SectionCard>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "blue" | "cyan" | "emerald" | "amber" | "rose"
}) {
  const tones = {
    blue: "from-blue-50 to-blue-100/70 text-blue-700",
    cyan: "from-cyan-50 to-cyan-100/70 text-cyan-700",
    emerald: "from-emerald-50 to-emerald-100/70 text-emerald-700",
    amber: "from-amber-50 to-amber-100/70 text-amber-700",
    rose: "from-rose-50 to-rose-100/70 text-rose-700",
  }

  return (
    <div className={cn("rounded-[28px] border border-slate-200 bg-gradient-to-br p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]", tones[tone])}>
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black tracking-[-0.05em]">{value}</div>
    </div>
  )
}

function DashboardTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-500 first:text-left">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className={cn(
                      "whitespace-nowrap px-4 py-4 text-right text-sm text-slate-700",
                      cellIndex === 0 && "text-left font-semibold text-slate-900",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
