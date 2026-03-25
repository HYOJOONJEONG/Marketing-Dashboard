"use client"

import { useState } from "react"
import { 
  Eye, EyeOff, Copy, Settings, 
  Send, ShoppingCart, ArrowLeftRight,
  ArrowUpRight, ArrowDownLeft, RefreshCw,
  X, Clock, Zap, ArrowRight, ChevronRight,
  User, Plus, Trash2, Vote, FileText, CheckCircle2, Search
} from "lucide-react"
import { cn } from "@/lib/utils"

interface HomeScreenProps {
  username: string
  totalBalance: string
  onOpenSettings?: () => void
}

const tokens = [
  { symbol: "STEEM", name: "Steem", balance: "20,049.00", usdValue: "$4,890.12", change: "+2.4%", iconUrl: "https://cryptologos.cc/logos/steem-steem-logo.png" },
  { symbol: "SBD", name: "Steem Dollar", balance: "6,800.05", usdValue: "$6,732.05", change: "+0.1%", iconUrl: "https://cryptologos.cc/logos/steem-dollars-sbd-logo.png" },
  { symbol: "SP", name: "Steem Power", balance: "15,000.00", usdValue: "$3,660.00", change: "+2.4%", iconUrl: "https://cryptologos.cc/logos/steem-steem-logo.png" },
  { symbol: "HARI", name: "Hari Point", balance: "1,250.00", usdValue: "$125.00", change: "+5.2%", gradient: "from-[#10B3A3] to-[#0E9E90]" },
]

const recentActivity = [
  { id: "1", type: "received", label: "steemit", amount: "+125.00 STEEM", time: "2h ago", icon: ArrowDownLeft },
  { id: "2", type: "sent", label: "binance", amount: "-50.00 STEEM", time: "5h ago", icon: ArrowUpRight },
  { id: "3", type: "reward", label: "Post reward", amount: "+12.50 SBD", time: "1d ago", icon: RefreshCw },
]

const quickActions = [
  { icon: Send, label: "Send" },
  { icon: ShoppingCart, label: "Buy" },
  { icon: ArrowLeftRight, label: "Swap" },
]

export function HomeScreen({ username, totalBalance, onOpenSettings }: HomeScreenProps) {
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

  const handleAddAccount = () => {
    const account = customAccountInput.trim().toLowerCase().replace(/^@/, '')
    if (account && !savedAccounts.includes(account)) {
      setSavedAccounts([...savedAccounts, account])
      setDelegateToAccount(account)
      setCustomAccountInput("")
      setShowAccountInput(false)
    }
  }

  const handleRemoveAccount = (account: string) => {
    if (account === "h4lab") return // Don't remove default
    const newAccounts = savedAccounts.filter(a => a !== account)
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
      {/* Header */}
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
            <span className="text-xs text-[#7C8F8C]">
              {copied ? "Copied!" : "Steem Account"}
            </span>
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

      {/* Balance Card */}
      <div className="px-4 py-3">
        <div 
          className="p-5 rounded-2xl text-white"
          style={{ 
            background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
            boxShadow: "0 8px 32px rgba(16, 179, 163, 0.35)"
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-white/80 font-medium">Total Balance</p>
            <button 
              onClick={() => setHideBalance(!hideBalance)}
              className="text-white/80 hover:text-white transition-colors"
            >
              {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-baseline gap-1 mb-5">
            <span className="text-xl font-light text-white/90">$</span>
            <span className="text-4xl font-bold tracking-tight">
              {hideBalance ? "••••••" : "26,849.05"}
            </span>
          </div>
          
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <button 
                key={action.label}
                className="flex flex-col items-center gap-2 py-3 rounded-xl bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
              >
                <action.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Delegate and Earn Banner - Clickable */}
        <button 
          onClick={() => setShowDelegateModal(true)}
          className="w-full mb-4 p-4 rounded-2xl bg-white border border-[#E0EEEB] relative overflow-hidden text-left hover:border-[#10B3A3]/30 transition-all group"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-[#1F2A2A]">Delegate and Earn</h4>
                <span className="px-2 py-0.5 rounded-full bg-[#10B3A3]/10 text-[#10B3A3] text-[10px] font-semibold">APY</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#7C8F8C]">When posting every day</span>
                  <span className="text-xs font-bold text-[#10B3A3]">21.4%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#7C8F8C]">When you don't post</span>
                  <span className="text-xs font-bold text-[#7C8F8C]">7.3%</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] flex items-center justify-center"
                style={{ boxShadow: "0 4px 12px rgba(16, 179, 163, 0.3)" }}
              >
                <span className="text-white text-lg font-bold">SP</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#7C8F8C] group-hover:text-[#10B3A3] transition-colors" />
            </div>
          </div>
        </button>

        {/* Assets */}
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide mb-2">Assets</h3>
          <div 
            className="rounded-2xl bg-white overflow-hidden"
            style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
          >
            {tokens.map((token, idx) => (
              <div 
                key={token.symbol} 
                className={cn(
                  "flex items-center justify-between p-3.5 transition-colors hover:bg-[#F3FAF8]/50",
                  idx < tokens.length - 1 && "border-b border-[#E0EEEB]"
                )}
              >
                <div className="flex items-center gap-3">
                  {token.iconUrl ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-[#F3FAF8] flex items-center justify-center">
                      <img 
                        src={token.iconUrl} 
                        alt={token.symbol}
                        className="w-6 h-6 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.parentElement!.innerHTML = `<span class="text-sm font-bold text-[#10B3A3]">${token.symbol.charAt(0)}</span>`
                        }}
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br",
                      token.gradient
                    )}
                    style={{ boxShadow: "0 4px 12px rgba(16, 179, 163, 0.25)" }}
                    >
                      {token.symbol.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-[#1F2A2A]">{token.symbol}</p>
                    <p className="text-xs text-[#7C8F8C]">{token.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1F2A2A]">
                    {hideBalance ? "••••" : token.balance}
                  </p>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-xs text-[#7C8F8C]">{hideBalance ? "••••" : token.usdValue}</span>
                    <span className={cn(
                      "text-[10px] font-medium",
                      token.change?.startsWith("+") ? "text-[#10B3A3]" : "text-red-500"
                    )}>
                      {token.change}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-[#10B3A3] uppercase tracking-wide">Recent Activity</h3>
            <button className="text-xs text-[#10B3A3] font-medium hover:text-[#0E9E90] transition-colors">View All</button>
          </div>
          <div 
            className="rounded-2xl bg-white overflow-hidden"
            style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
          >
            {recentActivity.map((activity, idx) => (
              <div 
                key={activity.id} 
                className={cn(
                  "flex items-center justify-between p-3 transition-colors hover:bg-[#F3FAF8]/50",
                  idx < recentActivity.length - 1 && "border-b border-[#E0EEEB]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    activity.type === "received" && "bg-[#10B3A3]/10 text-[#10B3A3]",
                    activity.type === "sent" && "bg-red-500/10 text-red-500",
                    activity.type === "reward" && "bg-amber-500/10 text-amber-500",
                  )}>
                    <activity.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1F2A2A]">{activity.label}</p>
                    <p className="text-xs text-[#7C8F8C]">{activity.time}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-sm font-semibold",
                  activity.type === "sent" ? "text-[#1F2A2A]" : "text-[#10B3A3]"
                )}>
                  {hideBalance ? "••••" : activity.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delegate Modal - Streamlined */}
      {showDelegateModal && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end justify-center">
          <div 
            className="w-full bg-white rounded-t-3xl max-h-[85%] flex flex-col animate-in slide-in-from-bottom duration-300"
            style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.15)" }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#E0EEEB]">
              <h2 className="text-lg font-bold text-[#1F2A2A]">Delegate & Earn</h2>
              <button 
                onClick={() => setShowDelegateModal(false)}
                className="w-8 h-8 rounded-full bg-[#F3FAF8] flex items-center justify-center text-[#7C8F8C] hover:bg-[#E0EEEB] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shared SP Info Card */}
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

            {/* Tab Switcher */}
            <div className="flex p-1.5 mx-4 mt-4 bg-[#F3FAF8] rounded-xl">
              <button
                onClick={() => setDelegateTab("delegate")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all",
                  delegateTab === "delegate" 
                    ? "bg-white text-[#10B3A3] shadow-sm" 
                    : "text-[#7C8F8C]"
                )}
              >
                Manual Delegate
              </button>
              <button
                onClick={() => setDelegateTab("autostake")}
                className={cn(
                  "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5",
                  delegateTab === "autostake" 
                    ? "bg-white text-[#10B3A3] shadow-sm" 
                    : "text-[#7C8F8C]"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Auto Stake
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {delegateTab === "delegate" ? (
                <div className="space-y-4">
                  {/* Delegate To Account */}
                  <div>
                    <label className="text-xs text-[#7C8F8C] uppercase tracking-wide mb-2 block">Delegate To</label>
                    
                    {/* Saved Accounts */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {savedAccounts.map((account) => (
                        <button
                          key={account}
                          onClick={() => setDelegateToAccount(account)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                            delegateToAccount === account
                              ? "bg-[#10B3A3] text-white"
                              : "bg-[#F3FAF8] text-[#1F2A2A] border border-[#E0EEEB] hover:border-[#10B3A3]"
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
                      
                      {/* Add Custom Account Button */}
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

                    {/* Custom Account Input */}
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
                            onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
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

                  {/* Amount Input */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-[#7C8F8C] uppercase tracking-wide">Amount to Delegate</label>
                      <button 
                        onClick={() => setDelegateAmount(availableSP.replace(/,/g, ''))}
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

                  {/* Delegate Button */}
                  <button 
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#10B3A3] to-[#0E9E90] text-white font-bold text-sm hover:opacity-90 transition-opacity"
                    style={{ boxShadow: "0 4px 16px rgba(16, 179, 163, 0.4)" }}
                  >
                    Delegate to @{delegateToAccount}
                  </button>

                  {/* Enable Auto Stake Option - Only show for h4lab */}
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
                        className={cn(
                          "w-12 h-7 rounded-full transition-colors relative",
                          autoStakeEnabled ? "bg-[#10B3A3]" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-full bg-white absolute top-1 transition-transform shadow-sm",
                          autoStakeEnabled ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Auto Stake Description */}
                  <p className="text-sm text-[#7C8F8C] leading-relaxed">
                    Automatically claim, power up, and delegate rewards to H4LAB every hour.
                  </p>

                  {/* Settings Grid */}
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

                  {/* Execute Button */}
                  <button 
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-[#10B3A3] to-[#0E9E90] text-white font-bold text-sm hover:opacity-90 transition-opacity"
                    style={{ boxShadow: "0 4px 16px rgba(16, 179, 163, 0.4)" }}
                  >
                    Activate Auto Stake
                  </button>

                  {/* Timer */}
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Clock className="w-4 h-4 text-[#7C8F8C]" />
                    <span className="text-sm text-[#7C8F8C]">Next claim in</span>
                    <span className="text-sm font-bold text-[#10B3A3]">00:18:18</span>
                  </div>

                  {/* Features */}
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
    </div>
  )
}
