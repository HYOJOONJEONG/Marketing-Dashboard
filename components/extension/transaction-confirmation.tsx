"use client"

import { AlertTriangle, X, ExternalLink, Shield, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TransactionDetail {
  label: string
  value: string
  highlight?: boolean
}

interface TransactionConfirmationProps {
  type: string
  from: string
  to?: string
  amount?: string
  currency?: string
  memo?: string
  details?: TransactionDetail[]
  website?: string
  onConfirm: () => void
  onReject: () => void
  onClose?: () => void
  isHighRisk?: boolean
}

export function TransactionConfirmation({
  type,
  from,
  to,
  amount,
  currency = "STEEM",
  memo,
  details = [],
  website,
  onConfirm,
  onReject,
  onClose,
  isHighRisk = false,
}: TransactionConfirmationProps) {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/H4LAB_logo%28%EB%B0%B0%EA%B2%BDx%29-cLLp6bwyE1Rl7L13pSahrS4rYHsAM7.png"
            alt="H4LAB"
            className="h-6 w-auto"
          />
          <span className="text-sm font-semibold text-foreground">Transaction Request</span>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Warning Banner */}
        {isHighRisk && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]">
            <AlertTriangle className="h-5 w-5 text-[var(--warning)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--warning)]">High Risk Transaction</p>
              <p className="text-xs text-[var(--warning)]/80 mt-0.5">
                Please review this transaction carefully before approving.
              </p>
            </div>
          </div>
        )}

        {/* Website Source */}
        {website && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center border border-border">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Requesting Website</p>
              <p className="text-sm font-medium text-foreground truncate">{website}</p>
            </div>
          </div>
        )}

        {/* Transaction Type */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Transaction Type
            </span>
            <span className="text-sm font-semibold text-primary">{type}</span>
          </div>

          {/* Amount (if applicable) */}
          {amount && (
            <div className="py-4 border-y border-border my-3">
              <p className="text-xs text-muted-foreground mb-1">Amount</p>
              <p className="text-2xl font-bold text-foreground">
                {amount} <span className="text-lg font-medium text-muted-foreground">{currency}</span>
              </p>
            </div>
          )}

          {/* From/To */}
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">From</p>
              <p className="text-sm font-medium text-foreground">@{from}</p>
            </div>
            {to && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <p className="text-sm font-medium text-foreground">@{to}</p>
              </div>
            )}
          </div>

          {/* Memo */}
          {memo && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Memo</p>
              <p className="text-sm text-foreground bg-muted p-2 rounded-lg break-all">
                {memo}
              </p>
            </div>
          )}

          {/* Additional Details */}
          {details.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              {details.map((detail, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{detail.label}</span>
                  <span className={cn(
                    "text-sm font-medium",
                    detail.highlight ? "text-primary" : "text-foreground"
                  )}>
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary">
          <Shield className="h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground">
            Your private keys never leave this extension
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-3">
          <Clock className="h-3.5 w-3.5" />
          <span>This request will expire in 5 minutes</span>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onReject}
          >
            Reject
          </Button>
          <Button 
            className="flex-1 bg-primary hover:bg-[var(--teal-hover)] text-primary-foreground"
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  )
}
