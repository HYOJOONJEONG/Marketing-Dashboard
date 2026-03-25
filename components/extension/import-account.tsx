"use client"

import { useState } from "react"
import { ArrowLeft, Eye, EyeOff, Upload, Key, Shield, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ImportStep = "method" | "credentials" | "confirm" | "success"

interface ImportAccountProps {
  onBack?: () => void
  onComplete?: () => void
}

export function ImportAccount({ onBack, onComplete }: ImportAccountProps) {
  const [step, setStep] = useState<ImportStep>("method")
  const [importMethod, setImportMethod] = useState<"key" | "file" | null>(null)
  const [username, setUsername] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleImport = async () => {
    setIsLoading(true)
    // Simulate import
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsLoading(false)
    setStep("success")
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {step !== "success" && (
          <button 
            onClick={step === "method" ? onBack : () => setStep("method")}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {step === "success" ? "Import Complete" : "Import Account"}
          </h2>
          {step !== "success" && (
            <p className="text-xs text-muted-foreground">
              {step === "method" && "Choose import method"}
              {step === "credentials" && "Enter your credentials"}
              {step === "confirm" && "Review and confirm"}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {step === "method" && (
          <div className="space-y-3">
            <button
              onClick={() => {
                setImportMethod("key")
                setStep("credentials")
              }}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all",
                "hover:border-primary hover:bg-secondary",
                "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Import with Private Key</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your Steem private posting or active key
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setImportMethod("file")
                setStep("credentials")
              }}
              className={cn(
                "w-full p-4 rounded-xl border-2 text-left transition-all",
                "hover:border-primary hover:bg-secondary",
                "border-border bg-card"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Import from Backup File</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Restore from a previously exported backup
                  </p>
                </div>
              </div>
            </button>

            <div className="mt-6 p-3 rounded-lg bg-secondary">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-primary mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Your keys are encrypted and stored locally. They never leave your device.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "credentials" && importMethod === "key" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Username</label>
              <Input
                placeholder="Enter your Steem username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Private Key</label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="Enter your private key"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use your posting key for read operations, or active key for transfers
              </p>
            </div>

            <div className="p-3 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]">
              <p className="text-xs text-[var(--warning)]">
                Never share your private keys. H4LAB will never ask for your keys outside this extension.
              </p>
            </div>
          </div>
        )}

        {step === "credentials" && importMethod === "file" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary hover:bg-secondary/50 transition-all cursor-pointer">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Drop backup file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Backup Password</label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="Enter backup password"
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Account Imported!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Your account has been successfully imported and is ready to use.
            </p>
            <div className="w-full p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  {username.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">@{username || "username"}</p>
                  <p className="text-xs text-muted-foreground">Active Key Imported</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border">
        {step === "credentials" && (
          <Button
            className="w-full bg-primary hover:bg-[var(--teal-hover)] text-primary-foreground"
            disabled={importMethod === "key" && (!username || !privateKey)}
            onClick={handleImport}
          >
            {isLoading ? "Importing..." : "Import Account"}
          </Button>
        )}
        {step === "success" && (
          <Button
            className="w-full bg-primary hover:bg-[var(--teal-hover)] text-primary-foreground"
            onClick={onComplete}
          >
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
