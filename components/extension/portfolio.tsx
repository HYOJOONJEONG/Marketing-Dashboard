"use client"

import { ArrowLeft, TrendingUp, TrendingDown, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface Token {
  symbol: string
  name: string
  balance: string
  value: string
  change: number
  icon?: string
}

interface PortfolioProps {
  tokens: Token[]
  totalValue: string
  totalChange: number
  onBack?: () => void
}

function TokenRow({ token }: { token: Token }) {
  const isPositive = token.change >= 0

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl transition-colors cursor-pointer">
      <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-primary font-bold text-sm">
        {token.symbol.charAt(0)}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{token.symbol}</p>
        <p className="text-xs text-muted-foreground">{token.name}</p>
      </div>
      
      <div className="text-right">
        <p className="text-sm font-semibold text-foreground">{token.balance}</p>
        <div className="flex items-center justify-end gap-1">
          <span className="text-xs text-muted-foreground">${token.value}</span>
          <span className={cn(
            "text-xs font-medium flex items-center gap-0.5",
            isPositive ? "text-[var(--success)]" : "text-destructive"
          )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{token.change.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export function Portfolio({ tokens, totalValue, totalChange, onBack }: PortfolioProps) {
  const isPositive = totalChange >= 0

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <h2 className="text-sm font-semibold text-foreground">Portfolio</h2>
      </div>

      {/* Total Value Card */}
      <div className="m-4 p-5 rounded-xl bg-gradient-to-br from-[#10B3A3] to-[#0E9E90] text-white">
        <p className="text-sm font-medium text-white/80 mb-1">Total Portfolio Value</p>
        <p className="text-3xl font-bold tracking-tight">${totalValue}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
            isPositive ? "bg-white/20 text-white" : "bg-red-500/20 text-white"
          )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{totalChange.toFixed(2)}% (24h)
          </span>
        </div>
      </div>

      {/* Token List */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Assets</h3>
          <button className="p-1 hover:bg-muted rounded-lg transition-colors">
            <Info className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        
        <div className="space-y-1">
          {tokens.map((token) => (
            <TokenRow key={token.symbol} token={token} />
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-center text-muted-foreground">
          Prices updated automatically • Powered by CoinGecko
        </p>
      </div>
    </div>
  )
}
