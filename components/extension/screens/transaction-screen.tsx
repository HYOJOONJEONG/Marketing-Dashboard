"use client"

import { useState } from "react"
import { X, Shield, AlertTriangle, ChevronDown, ArrowDown, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface TransactionScreenProps {
  onConfirm: () => void
  onReject: () => void
}

export function TransactionScreen({ onConfirm, onReject }: TransactionScreenProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const handleConfirm = () => {
    setIsConfirming(true)
    setTimeout(() => {
      setIsConfirming(false)
      onConfirm()
    }, 1500)
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F5F7FA]">
        <h1 className="text-lg font-bold text-foreground">Confirm Transaction</h1>
        <button onClick={onReject} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#F5F7FA]">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#F5F7FA]">
        {/* Site Info */}
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-semibold text-sm">S</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground">steemit.com</p>
              <Shield className="w-3.5 h-3.5 text-[#22C55E]" />
            </div>
            <p className="text-xs text-muted-foreground">Requesting transfer approval</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Operation Type */}
        <div className="flex justify-center mb-3">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-xs font-semibold text-primary">Transfer</span>
        </div>

        {/* Amount */}
        <div className="text-center mb-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-2xl font-light text-primary">$</span>
            <span className="text-4xl font-bold tracking-tight text-foreground">100.00</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">100.000 STEEM</p>
        </div>

        {/* From/To */}
        <div className="space-y-2 mb-4">
          <div className="p-3 rounded-xl bg-white" style={{ border: "1px dashed #E8ECF1" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center text-white font-medium text-xs">H</div>
                <div>
                  <p className="text-[10px] text-muted-foreground">From</p>
                  <p className="text-sm font-medium text-foreground">@h4lab.user</p>
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground">120.50 STEEM</span>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm">
              <ArrowDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white" style={{ border: "1px dashed #E8ECF1" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-teal-500 flex items-center justify-center text-white font-medium text-xs">S</div>
              <div>
                <p className="text-[10px] text-muted-foreground">To</p>
                <p className="text-sm font-medium text-foreground">@steemit</p>
              </div>
            </div>
          </div>
        </div>

        {/* Details Toggle */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-white mb-3"
        >
          <span className="text-xs font-semibold text-foreground">Transaction Details</span>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showDetails && "rotate-180")} />
        </button>

        {showDetails && (
          <div className="space-y-2.5 mb-3 p-3 rounded-xl bg-white">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Memo</span>
              <span className="text-xs font-medium text-foreground">Payment for services</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Network</span>
              <span className="text-xs font-medium text-foreground">Steem Mainnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Network Fee</span>
              <span className="text-xs font-medium text-foreground">Free</span>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Only confirm transactions from sites you trust. This action cannot be undone.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2 bg-white border-t border-[#F5F7FA]">
        <button
          onClick={handleConfirm}
          disabled={isConfirming}
          className={cn(
            "w-full py-3.5 rounded-xl text-sm font-semibold transition-all",
            isConfirming ? "bg-[#F5F7FA] text-muted-foreground" : "bg-primary text-white"
          )}
        >
          {isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Confirming...
            </span>
          ) : "Approve"}
        </button>
        <button onClick={onReject} className="w-full py-3.5 rounded-xl text-sm font-medium text-muted-foreground bg-[#F5F7FA]">
          Reject
        </button>
      </div>
    </div>
  )
}
