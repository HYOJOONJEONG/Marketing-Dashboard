"use client"

import { useState } from "react"
import {
  AtSign,
  ChevronDown,
  ChevronLeft,
  Copy,
  SendHorizonal,
  Shield,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TransactionScreenProps {
  onConfirm: () => void
  onReject: () => void
}

const currencies = ["STEEM", "SBD", "SP"] as const

export function TransactionScreen({ onConfirm, onReject }: TransactionScreenProps) {
  const [username, setUsername] = useState("steemit")
  const [currency] = useState<(typeof currencies)[number]>("STEEM")
  const [amount, setAmount] = useState("100.000")
  const [memo, setMemo] = useState("Payment for services")
  const [isConfirming, setIsConfirming] = useState(false)

  const balanceByCurrency = {
    STEEM: "120.500",
    SBD: "62.100",
    SP: "15000.000",
  } as const

  const handleConfirm = () => {
    setIsConfirming(true)
    setTimeout(() => {
      setIsConfirming(false)
      onConfirm()
    }, 1200)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#F3FAF8]">
      <div className="absolute inset-x-0 top-0 h-[232px] bg-[linear-gradient(180deg,#E5F8F3_0%,#F3FAF8_100%)]" />
      <div className="absolute bottom-[-72px] left-[-40px] h-[220px] w-[220px] rounded-full bg-[#10B3A3]/8 blur-3xl" />
      <div className="absolute bottom-[-96px] right-[-60px] h-[240px] w-[240px] rounded-full bg-[#0E9E90]/6 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between px-4 py-4">
        <button
          onClick={onReject}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#1F2A2A] transition-colors hover:bg-[#F8FCFB]"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h1 className="text-[18px] font-bold tracking-[-0.02em] text-[#1F2A2A]">Transfer Funds</h1>

        <button
          onClick={onReject}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#1F2A2A] transition-colors hover:bg-[#F8FCFB]"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.06)" }}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 px-4 pb-5">
        <div
          className="rounded-[28px] px-5 py-5 text-white"
          style={{
            background: "linear-gradient(135deg, #10B3A3 0%, #0E9E90 100%)",
            boxShadow: "0 10px 28px rgba(16, 179, 163, 0.28)",
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75">Available Balance</p>
              <p className="mt-2 truncate text-[31px] font-bold leading-none tracking-[-0.05em]">
                {balanceByCurrency[currency]} {currency}
              </p>
              <p className="mt-2 text-[13px] font-medium text-white/75">Ready to send from your wallet</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/18">
              <SendHorizonal className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 px-4 pb-28 pt-1">
        <div
          className="rounded-[28px] border border-[#E0EEEB] bg-white px-4 py-5"
          style={{ boxShadow: "0 10px 28px rgba(0,0,0,0.06)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#10B3A3]">Transfer Details</p>
              <p className="mt-1 text-[13px] text-[#7C8F8C]">Fill out the transfer just like the rest of your wallet flow.</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#10B3A3]/10 text-[#10B3A3]">
              <Shield className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-5">
          <div className="space-y-3">
            <label className="block text-[14px] font-semibold tracking-[-0.02em] text-[#1F2A2A]">Username</label>
            <div
              className="flex h-[58px] items-center gap-3 rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] px-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10B3A3]/10 text-[#10B3A3]">
                <AtSign className="h-4.5 w-4.5" />
              </div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-transparent text-[15px] font-medium text-[#1F2A2A] placeholder:text-[#A4B2AF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-[118px_minmax(0,1fr)] gap-3">
            <div className="space-y-3">
              <label className="block text-[14px] font-semibold tracking-[-0.02em] text-[#1F2A2A]">Currency</label>
              <button
                className="flex h-[58px] w-full items-center justify-between rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] px-4"
              >
                <span className="text-[14px] font-semibold text-[#1F2A2A]">{currency}</span>
                <ChevronDown className="h-4.5 w-4.5 text-[#4C5D5A]" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-[14px] font-semibold tracking-[-0.02em] text-[#1F2A2A]">Amount</label>
              <div
                className="flex h-[58px] items-center rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] px-4"
              >
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#1F2A2A] placeholder:text-[#A4B2AF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setAmount(balanceByCurrency[currency])}
                  className="ml-3 border-l border-[#E0EEEB] pl-3 text-[13px] font-semibold text-[#10B3A3]"
                >
                  MAX
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[14px] font-semibold tracking-[-0.02em] text-[#1F2A2A]">Memo (optional)</label>
            <div
              className="flex h-[58px] items-center rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] px-4"
            >
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Memo (optional)"
                className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#1F2A2A] placeholder:text-[#A4B2AF] focus:outline-none"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!memo) return
                  await navigator.clipboard.writeText(memo)
                }}
                className="ml-3 border-l border-[#E0EEEB] pl-3 text-[#10B3A3]"
              >
                <Copy className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E0EEEB] bg-[#F8FCFB] px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10B3A3]/10 text-[#10B3A3]">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[#1F2A2A]">Review before sending</p>
                <p className="mt-1 text-[12px] leading-5 text-[#7C8F8C]">
                  Check the username, asset, amount, and memo one more time before you confirm.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4 pt-4">
        <button
          onClick={handleConfirm}
          disabled={isConfirming || !username || !amount}
          className={cn(
            "flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-semibold text-white transition-all",
            isConfirming || !username || !amount
              ? "bg-[#8BCFC7]"
              : "bg-[#10B3A3] shadow-[0_16px_28px_rgba(16,179,163,0.28)] hover:bg-[#0E9E90]",
          )}
        >
          <SendHorizonal className="h-5 w-5" />
          {isConfirming ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  )
}
