"use client"

import { useState } from "react"
import { Eye, EyeOff, Plus, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoginScreenProps {
  onUnlock: () => void
}

export function LoginScreen({ onUnlock }: LoginScreenProps) {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleUnlock = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onUnlock()
    }, 800)
  }

  return (
    <div 
      className="flex-1 flex flex-col"
      style={{ 
        background: "linear-gradient(180deg, #10B3A3 0%, #0E9E90 100%)" 
      }}
    >
      {/* Brand Hero - Large Centered Logo */}
      <div className="flex flex-col items-center justify-center pt-12 pb-8 px-6">
        {/* Large H4 Logo */}
        <div 
          className="mb-4"
          style={{ 
            filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))" 
          }}
        >
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/H4LAB_logo%28%EB%B0%B0%EA%B2%BDx%29-cLLp6bwyE1Rl7L13pSahrS4rYHsAM7.png"
            alt="H4LAB"
            className="w-32 h-32 object-contain brightness-0 invert"
          />
        </div>
        
        {/* Brand Name */}
        <h1 className="text-white text-xl font-bold tracking-wide">H4LAB</h1>
        <span className="text-white/70 text-xs font-medium tracking-wider mt-1">Steem Wallet</span>
      </div>

      {/* White Card Form Area */}
      <div 
        className="flex-1 flex flex-col px-5 pt-6 pb-5 bg-white"
        style={{ 
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.1)"
        }}
      >
        {/* Title */}
        <div className="text-center mb-5">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Welcome Back</h2>
          <p className="text-sm text-[#5F7471] mt-0.5">Enter your password to unlock</p>
        </div>

        {/* Password Input */}
        <div className="w-full space-y-3">
          <div 
            className="relative rounded-xl overflow-hidden bg-[#F5F7FA] border border-[#E5E7EB] focus-within:border-[#10B3A3] transition-colors"
          >
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && handleUnlock()}
              className="w-full px-4 py-3.5 bg-transparent text-[#1A1A2E] placeholder:text-[#9CA3AF] focus:outline-none text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>

          <button
            onClick={handleUnlock}
            disabled={!password || isLoading}
            className={cn(
              "w-full py-3.5 rounded-xl text-sm font-semibold transition-all",
              password && !isLoading
                ? "bg-[#10B3A3] text-white hover:bg-[#0E9E90]"
                : "bg-[#E5E7EB] text-[#9CA3AF]"
            )}
            style={password && !isLoading ? { boxShadow: "0 4px 12px rgba(16,179,163,0.25)" } : {}}
          >
            {isLoading ? "Unlocking..." : "Unlock Wallet"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full my-5">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-xs text-[#9CA3AF]">or</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        {/* Import / Create Options */}
        <div className="w-full grid grid-cols-2 gap-3">
          <button 
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#1A1A2E] bg-[#F5F7FA] border border-[#E5E7EB] hover:bg-[#EBEEF1] transition-colors"
          >
            <Download className="w-4 h-4" />
            Import
          </button>
          <button 
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#1A1A2E] bg-[#F5F7FA] border border-[#E5E7EB] hover:bg-[#EBEEF1] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Forgot Password */}
        <button className="text-xs text-[#10B3A3] font-medium hover:underline self-center mt-4">
          Forgot Password?
        </button>
      </div>
    </div>
  )
}
