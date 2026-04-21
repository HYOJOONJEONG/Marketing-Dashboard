"use client"

import { useState } from "react"
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  EyeOff,
  History,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShoppingCart,
  Vote,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface HomeScreenProps {
  username: string
  totalBalance: string
  onOpenSettings?: () => void
  onOpenGovernance?: () => void
}

function AssetLogo({ symbol, accent }: { symbol: string; accent?: string }) {
  if (symbol === "STEEM" || symbol === "SBD") {
    return (
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5", accent)}>
        <div className="flex items-center gap-[2px]">
          <span className="h-5 w-[4px] rounded-full bg-current opacity-80" />
          <span className="h-6 w-[4px] rounded-full bg-current" />
          <span className="h-5 w-[4px] rounded-full bg-current opacity-80" />
        </div>
      </div>
    )
  }

  if (symbol === "SP") {
    return (
      <div className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5", accent)}>
        <div className="flex items-center gap-[2px]">
          <span className="h-5 w-[4px] rounded-full bg-current opacity-80" />
          <span className="h-6 w-[4px] rounded-full bg-current" />
          <span className="h-5 w-[4px] rounded-full bg-current opacity-80" />
        </div>
        <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#FFF4CC] text-[8px] font-bold text-[#C99915] ring-2 ring-white">
          P
        </span>
      </div>
    )
  }

  return (
    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ring-black/5", accent)}>
      <span className="tracking-[-0.03em]">{symbol.charAt(0)}</span>
    </div>
  )
}

const tokens = [
  {
    symbol: "STEEM",
    name: "Steem",
    balance: "20,049.00",
    usdValue: "$4,890.12",
    change: "+2.4%",
    accent: "bg-[#EEF5FF] text-[#4D8EF7]",
    actions: [
      { label: "Send", icon: Send },
      { label: "Power Up", icon: Zap },
      { label: "Savings", icon: Plus },
    ],
  },
  {
    symbol: "SBD",
    name: "Steem Dollar",
    balance: "6,800.05",
    usdValue: "$6,732.05",
    change: "+0.1%",
    accent: "bg-[#EEF8EA] text-[#5AAA57]",
    actions: [
      { label: "Send", icon: Send },
      { label: "Convert", icon: ArrowLeftRight },
      { label: "Savings", icon: Plus },
    ],
  },
  {
    symbol: "SP",
    name: "Steem Power",
    balance: "15,000.00",
    usdValue: "$3,660.00",
    change: "+2.4%",
    accent: "bg-[#EEF3FF] text-[#5A8FF5]",
    actions: [
      { label: "SP Deleg.", icon: ArrowLeftRight },
      { label: "Power Down", icon: ArrowDownLeft },
    ],
  },
  {
    symbol: "HARI",
    name: "Hari Point",
    balance: "1,250.00",
    usdValue: "$125.00",
    change: "+5.2%",
    gradient: "from-[#10B3A3] to-[#0E9E90]",
    accent: "bg-[#EAFBF7] text-[#10B3A3]",
    actions: [
      { label: "Send", icon: Send },
      { label: "Stake", icon: Zap },
      { label: "Rewards", icon: RefreshCw },
    ],
  },
]

const recentActivity = [
  { id: "1", type: "received", label: "steemit", amount: "+125.00 STEEM", time: "2h ago", icon: ArrowDownLeft },
  { id: "2", type: "sent", label: "binance", amount: "-50.00 STEEM", time: "5h ago", icon: ArrowUpRight },
  { id: "3", type: "reward", label: "Post reward", amount: "+12.50 SBD", time: "1d ago", icon: RefreshCw },
]

const steemHistory = [
  { id: "1", type: "sent", label: "@peakd", amount: "-24.500 STEEM", time: "Today, 11:20", status: "Completed", icon: ArrowUpRight },
  { id: "2", type: "received", label: "@steemit", amount: "+125.000 STEEM", time: "Today, 08:45", status: "Reward", icon: ArrowDownLeft },
  { id: "3", type: "sent", label: "@savings", amount: "-300.000 STEEM", time: "Yesterday", status: "Savings", icon: ArrowRight },
]

const quickActions = [
  { icon: Send, label: "Send", action: "send" },
  { icon: ShoppingCart, label: "Buy", action: "buy" },
  { icon: ArrowLeftRight, label: "Swap", action: "swap" },
  { icon: Vote, label: "Vote", action: "witness" },
] as const

export function HomeScreen({ username, totalBalance, onOpenSettings, onOpenGovernance }: HomeScreenProps) {
  const [hideBalance, setHideBalance] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDelegateModal, setShowDelegateModal] = useState(false)
  const [delegateTab, setDelegateTab] = useState<"delegate" | "autostake">("delegate")
  const [delegateAmount, setDelegateAmount] = useState("")
  const [autoStakeEnabled, setAutoStakeEnabled] = useState(false)
  const [minHoldings, setMinHoldings] = useState("0")
  const [powerUpCriteria, setPowerUpCriteria] = useState("0")
  const [delegateToAccount, setDelegateToAccount] = useState("h4lab")
  const [customAccountInput, setCustomAccountInput] = useState("")
  const [savedAccounts, setSavedAccounts] = useState<string[]>(["h4lab"])
  const [showAccountInput, setShowAccountInput] = useState(false)
  const [showSteemHistory, setShowSteemHistory] = useState(false)
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null)

  const handleAddAccount = () => {
    const account = customAccountInput.trim().toLowerCase().replace(/^@/, "")
    if (account && !savedAccounts.includes(account)) {
      setSavedAccounts([...savedAccounts, account])
      setDelegateToAccount(account)
      setCustomAccountInput("")
      setShowAccountInput(false)
    }
  }

  const handleRemoveAccount = (account: string) => {
    if (account === "h4lab") return
    const newAccounts = savedAccounts.filter((a) => a !== account)
    setSavedAccounts(newAccounts)
    if (delegateToAccount === account) {
      setDelegateToAccount("h4lab")
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(username)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const availableSP = "15,000.00"
  const delegatedSP = "0"

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F3FAF8]">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] flex items-center justify-center text-white font-semibold text-sm"
            style={{ boxShadow: "0 4px 12px rgba(16, 179, 163, 0.3)" }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[#1F2A2A]">@{username}</span>
              <button onClick={handleCopy} className="text-[#10B3A3] hover:text-[#0E9E90] transition-colors">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[11px] text-[#7C8F8C]">{copied ? "Copied!" : "Steem Account"}</span>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-[#10B3A3] hover:bg-[#10B3A3] hover:text-white transition-all border border-[#E0EEEB]"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div
          className="p-5 rounded-2xl text-white"
          style={{
            background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
            boxShadow: "0 8px 32px rgba(16, 179, 163, 0.35)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] text-white/80 font-medium">Total Balance</p>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-white/80 hover:text-white transition-colors">
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="mb-5 flex items-end gap-1.5">
            <span className="pb-1 text-lg font-light text-white/90">$</span>
            <span className="min-w-0 truncate text-[2.15rem] font-bold leading-none tracking-[-0.03em]">
              {hideBalance ? "******" : totalBalance}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.action === "witness" ? onOpenGovernance : undefined}
                className="aspect-square flex w-full flex-col items-center justify-center gap-2 rounded-2xl bg-white/18 px-1.5 py-2 transition-colors backdrop-blur-sm hover:bg-white/28"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/18">
                  <action.icon className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-semibold text-center leading-[1.15] tracking-[-0.01em] text-white">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <button
          onClick={() => setShowDelegateModal(true)}
          className="w-full mb-4 p-4 rounded-2xl bg-white border border-[#E0EEEB] relative overflow-hidden text-left hover:border-[#10B3A3]/30 transition-all group"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="truncate text-[14px] font-semibold text-[#1F2A2A]">Delegate and Earn</h4>
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#10B3A3]/10 text-[#10B3A3] text-[11px] font-semibold">APY</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#7C8F8C]">When posting every day</span>
                  <span className="shrink-0 text-[12px] font-bold text-[#10B3A3]">21.4%</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#7C8F8C]">When you don&apos;t post</span>
                  <span className="shrink-0 text-[12px] font-bold text-[#7C8F8C]">7.3%</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] flex items-center justify-center"
                style={{ boxShadow: "0 4px 12px rgba(16, 179, 163, 0.3)" }}
              >
                <span className="text-white text-lg font-bold">SP</span>
              </div>
              <ArrowRight className="w-5 h-5 text-[#7C8F8C] group-hover:text-[#10B3A3] transition-colors" />
            </div>
          </div>
        </button>

        <div className="mb-4">
          <h3 className="text-[11px] font-semibold text-[#10B3A3] uppercase tracking-[0.14em] mb-2">Assets</h3>
          <div className="space-y-3">
            {tokens.map((token) => (
              <div
                key={token.symbol}
                className="rounded-[26px] border border-[#E0EEEB] bg-white p-4"
                style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
              >
                <button
                  type="button"
                  onClick={() =>
                    "actions" in token && token.actions
                      ? setExpandedAsset((current) => (current === token.symbol ? null : token.symbol))
                      : undefined
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-3 text-left",
                    "actions" in token && token.actions && "cursor-pointer",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <AssetLogo symbol={token.symbol} accent={token.accent} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold tracking-[-0.02em] text-[#1F2A2A]">{token.symbol}</p>
                      <p className="text-[12px] text-[#7C8F8C]">{token.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="truncate text-[15px] font-bold text-[#1F2A2A]">{hideBalance ? "******" : token.balance}</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="truncate text-[12px] text-[#7C8F8C]">{hideBalance ? "******" : token.usdValue}</span>
                        <span className={cn("shrink-0 text-[11px] font-medium", token.change.startsWith("+") ? "text-[#10B3A3]" : "text-red-500")}>
                          {token.change}
                        </span>
                      </div>
                    </div>

                    {(token.symbol === "STEEM" || token.symbol === "SBD" || token.symbol === "SP" || token.symbol === "HARI") &&
                      expandedAsset === token.symbol && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowSteemHistory(true)
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] text-[#10B3A3] transition-colors hover:bg-[#F3FAF8]"
                      >
                        <History className="h-4.5 w-4.5" />
                      </button>
                    )}

                    {"actions" in token && token.actions && (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] text-[#7C8F8C]">
                        <ChevronDown
                          className={cn(
                            "h-4.5 w-4.5 transition-transform duration-200",
                            expandedAsset === token.symbol && "rotate-180 text-[#10B3A3]",
                          )}
                        />
                      </div>
                    )}
                  </div>
                </button>

                {"actions" in token && token.actions && expandedAsset === token.symbol && (
                  <div className={cn("mt-4 grid gap-3", token.actions.length === 3 ? "grid-cols-2" : "grid-cols-2")}>
                    {token.actions.map((action, actionIdx) => (
                      <button
                        key={action.label}
                        className={cn(
                          "flex h-[58px] items-center gap-3 rounded-2xl border border-[#EEF3F2] bg-[#FCFEFD] px-4 text-left transition-colors hover:bg-[#F7FBFA]",
                          token.actions.length === 3 && actionIdx === 2 && "col-span-1",
                        )}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#10B3A3]/10 text-[#10B3A3]">
                          <action.icon className="h-4.5 w-4.5" />
                        </div>
                        <span className="truncate text-[14px] font-semibold text-[#1F2A2A]">{action.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-[#10B3A3] uppercase tracking-[0.14em]">Recent Activity</h3>
            <button className="text-[11px] text-[#10B3A3] font-medium hover:text-[#0E9E90] transition-colors">View All</button>
          </div>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}>
            {recentActivity.map((activity, idx) => (
              <div
                key={activity.id}
                className={cn(
                  "flex items-center justify-between p-3 transition-colors hover:bg-[#F3FAF8]/50",
                  idx < recentActivity.length - 1 && "border-b border-[#E0EEEB]",
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center",
                      activity.type === "received" && "bg-[#10B3A3]/10 text-[#10B3A3]",
                      activity.type === "sent" && "bg-red-500/10 text-red-500",
                      activity.type === "reward" && "bg-amber-500/10 text-amber-500",
                    )}
                  >
                    <activity.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-[#1F2A2A]">{activity.label}</p>
                    <p className="text-[12px] text-[#7C8F8C]">{activity.time}</p>
                  </div>
                </div>
                <span className={cn("shrink-0 text-[14px] font-semibold", activity.type === "sent" ? "text-[#1F2A2A]" : "text-[#10B3A3]")}>
                  {hideBalance ? "******" : activity.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showDelegateModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div
            className="w-full bg-white rounded-t-3xl max-h-[85%] flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[#E0EEEB]">
              <h2 className="text-lg font-bold text-[#1F2A2A]">Delegate & Earn</h2>
              <button
                onClick={() => setShowDelegateModal(false)}
                className="w-8 h-8 rounded-full bg-[#F3FAF8] flex items-center justify-center text-[#7C8F8C] hover:bg-[#E0EEEB] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/80">Steem Power</span>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">SP</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/60 mb-1">Available</p>
                    <p className="text-lg font-bold">{availableSP}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60 mb-1">Delegated to H4LAB</p>
                    <p className="text-lg font-bold">{delegatedSP}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex p-1.5 mx-4 mt-4 bg-[#F3FAF8] rounded-xl">
              <button
                onClick={() => setDelegateTab("delegate")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                  delegateTab === "delegate" ? "bg-white text-[#10B3A3] shadow-sm" : "text-[#7C8F8C]",
                )}
              >
                Manual Delegate
              </button>
              <button
                onClick={() => setDelegateTab("autostake")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
                  delegateTab === "autostake" ? "bg-white text-[#10B3A3] shadow-sm" : "text-[#7C8F8C]",
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Auto Stake
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {delegateTab === "delegate" ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-[#7C8F8C] uppercase tracking-wide mb-2 block">Delegate To</label>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {savedAccounts.map((account) => (
                        <button
                          key={account}
                          onClick={() => setDelegateToAccount(account)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            delegateToAccount === account
                              ? "bg-[#10B3A3] text-white"
                              : "bg-[#F3FAF8] text-[#1F2A2A] border border-[#E0EEEB] hover:border-[#10B3A3]",
                          )}
                        >
                          <span>@{account}</span>
                          {account !== "h4lab" && delegateToAccount === account && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveAccount(account)
                              }}
                              className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </button>
                      ))}

                      {!showAccountInput && (
                        <button
                          onClick={() => setShowAccountInput(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-[#F3FAF8] text-[#10B3A3] border border-dashed border-[#10B3A3]/40 hover:bg-[#10B3A3]/5 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Other</span>
                        </button>
                      )}
                    </div>

                    {showAccountInput && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 flex items-center bg-[#F3FAF8] rounded-xl border border-[#E0EEEB] focus-within:border-[#10B3A3] focus-within:ring-2 focus-within:ring-[#10B3A3]/20 transition-all">
                          <span className="pl-3 text-[#7C8F8C]">@</span>
                          <input
                            type="text"
                            value={customAccountInput}
                            onChange={(e) => setCustomAccountInput(e.target.value.toLowerCase())}
                            placeholder="Enter account name"
                            className="flex-1 px-2 py-3 bg-transparent text-[#1F2A2A] text-sm focus:outline-none"
                            onKeyDown={(e) => e.key === "Enter" && handleAddAccount()}
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={handleAddAccount}
                          disabled={!customAccountInput.trim()}
                          className="px-4 py-3 rounded-xl bg-[#10B3A3] text-white text-sm font-semibold hover:bg-[#0E9E90] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAccountInput(false)
                            setCustomAccountInput("")
                          }}
                          className="p-3 rounded-xl bg-[#F3FAF8] text-[#7C8F8C] hover:bg-[#E0EEEB] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[#7C8F8C] uppercase tracking-wide">Amount to Delegate</label>
                      <button
                        onClick={() => setDelegateAmount(availableSP.replace(/,/g, ""))}
                        className="text-xs font-semibold text-[#10B3A3] hover:text-[#0E9E90]"
                      >
                        MAX
                      </button>
                    </div>
                    <div className="flex items-center bg-[#F3FAF8] rounded-xl border border-[#E0EEEB] focus-within:border-[#10B3A3] focus-within:ring-2 focus-within:ring-[#10B3A3]/20 transition-all">
                      <input
                        type="number"
                        value={delegateAmount}
                        onChange={(e) => setDelegateAmount(e.target.value)}
                        placeholder="0"
                        className="flex-1 px-4 py-4 bg-transparent text-[#1F2A2A] text-lg font-semibold focus:outline-none"
                      />
                      <span className="pr-4 text-sm font-semibold text-[#7C8F8C]">SP</span>
                    </div>
                  </div>

                  <button
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#10B3A3] to-[#0E9E90] text-white font-bold text-sm hover:opacity-90 transition-opacity"
                    style={{ boxShadow: "0 4px 16px rgba(16, 179, 163, 0.4)" }}
                  >
                    Delegate to @{delegateToAccount}
                  </button>

                  {delegateToAccount === "h4lab" && (
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[#F3FAF8] border border-[#E0EEEB]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#1F2A2A]">Enable Auto Stake</p>
                          <p className="text-xs text-[#7C8F8C]">Auto-reinvest rewards daily</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAutoStakeEnabled(!autoStakeEnabled)}
                        className={cn("w-12 h-7 rounded-full transition-colors relative", autoStakeEnabled ? "bg-[#10B3A3]" : "bg-gray-200")}
                      >
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full bg-white absolute top-1 transition-transform shadow-sm",
                            autoStakeEnabled ? "translate-x-6" : "translate-x-1",
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-[#7C8F8C] leading-relaxed">
                    Automatically claim, power up, and delegate rewards to H4LAB every hour.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#7C8F8C] mb-2 block">Min Holdings</label>
                      <div className="flex items-center bg-[#F3FAF8] rounded-xl border border-[#E0EEEB] focus-within:border-[#10B3A3]">
                        <input
                          type="number"
                          value={minHoldings}
                          onChange={(e) => setMinHoldings(e.target.value)}
                          className="flex-1 px-3 py-3 bg-transparent text-sm text-[#1F2A2A] focus:outline-none"
                        />
                        <span className="pr-3 text-xs text-[#7C8F8C]">STEEM</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-[#7C8F8C] mb-2 block">Power-Up Stop</label>
                      <div className="flex items-center bg-[#F3FAF8] rounded-xl border border-[#E0EEEB] focus-within:border-[#10B3A3]">
                        <input
                          type="number"
                          value={powerUpCriteria}
                          onChange={(e) => setPowerUpCriteria(e.target.value)}
                          className="flex-1 px-3 py-3 bg-transparent text-sm text-[#1F2A2A] focus:outline-none"
                        />
                        <span className="pr-3 text-xs text-[#7C8F8C]">STEEM</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#10B3A3] to-[#0E9E90] text-white font-bold text-sm hover:opacity-90 transition-opacity"
                    style={{ boxShadow: "0 4px 16px rgba(16, 179, 163, 0.4)" }}
                  >
                    Activate Auto Stake
                  </button>

                  <div className="flex items-center justify-center gap-2 py-2">
                    <Clock className="w-4 h-4 text-[#7C8F8C]" />
                    <span className="text-sm text-[#7C8F8C]">Next claim in</span>
                    <span className="text-sm font-bold text-[#10B3A3]">00:18:18</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-[#F3FAF8] text-center">
                      <Clock className="w-5 h-5 text-cyan-500 mx-auto mb-1.5" />
                      <p className="text-[10px] font-semibold text-[#1F2A2A]">Hourly</p>
                      <p className="text-[9px] text-[#7C8F8C]">Execution</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F3FAF8] text-center">
                      <Zap className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                      <p className="text-[10px] font-semibold text-[#1F2A2A]">Auto</p>
                      <p className="text-[9px] text-[#7C8F8C]">Power-Up</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F3FAF8] text-center">
                      <ArrowRight className="w-5 h-5 text-[#10B3A3] mx-auto mb-1.5" />
                      <p className="text-[10px] font-semibold text-[#1F2A2A]">Auto</p>
                      <p className="text-[9px] text-[#7C8F8C]">Delegate</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSteemHistory && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40">
          <div
            className="w-full rounded-t-[28px] bg-white px-4 pb-6 pt-3 animate-in slide-in-from-bottom duration-300"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#D8E7E3]" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#10B3A3]">Transaction History</p>
                <h3 className="mt-1 text-[18px] font-bold text-[#1F2A2A]">Recent STEEM activity</h3>
              </div>
              <button
                onClick={() => setShowSteemHistory(false)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#F3FAF8] text-[#7C8F8C] transition-colors hover:bg-[#E0EEEB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {steemHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                        item.type === "received" && "bg-[#10B3A3]/10 text-[#10B3A3]",
                        item.type === "sent" && "bg-[#1F2A2A]/6 text-[#1F2A2A]",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#1F2A2A]">{item.label}</p>
                      <p className="text-[12px] text-[#7C8F8C]">{item.time} · {item.status}</p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 text-[13px] font-semibold", item.type === "received" ? "text-[#10B3A3]" : "text-[#1F2A2A]")}>
                    {item.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
