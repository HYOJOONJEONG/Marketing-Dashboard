"use client"

import { Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface AccountCardProps {
  balance: string
  currency?: string
  fiatValue?: string
  username: string
}

export function AccountCard({ balance, currency = "STEEM", fiatValue, username }: AccountCardProps) {
  const [showBalance, setShowBalance] = useState(true)

  return (
    <div className="mx-4 mt-4 p-5 rounded-xl bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-white/80">Total Balance</span>
        <button 
          onClick={() => setShowBalance(!showBalance)}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
        >
          {showBalance ? (
            <Eye className="h-4 w-4 text-white/80" />
          ) : (
            <EyeOff className="h-4 w-4 text-white/80" />
          )}
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-3xl font-bold tracking-tight",
            !showBalance && "blur-sm select-none"
          )}>
            {balance}
          </span>
          <span className="text-lg font-medium text-white/90">{currency}</span>
        </div>
        {fiatValue && (
          <p className={cn(
            "text-sm text-white/70",
            !showBalance && "blur-sm select-none"
          )}>
            ≈ ${fiatValue} USD
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-white/20">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs font-bold">{username.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium">@{username}</span>
        </div>
      </div>
    </div>
  )
}
