"use client"

import { useEffect, useRef, useState } from "react"

export function NumberControl({ value, min, max, step, label, onCommit, className }: {
  value: number; min: number; max: number; step: number; label: string; onCommit: (value: number) => void; className?: string
}) {
  const [draft, setDraft] = useState(String(value))
  const editing = useRef(false)
  const cancelled = useRef(false)
  useEffect(() => { if (!editing.current) setDraft(String(value)) }, [value])
  function commit() {
    const number = Number(draft)
    if (!draft.trim() || !Number.isFinite(number)) { setDraft(String(value)); return }
    const normalized = Math.min(max, Math.max(min, number))
    setDraft(String(normalized))
    if (normalized !== value) onCommit(normalized)
  }
  return <input type="number" inputMode="decimal" aria-label={label} min={min} max={max} step={step} value={draft} className={className}
    onFocus={() => { editing.current = true; cancelled.current = false }} onChange={event => setDraft(event.target.value)}
    onBlur={() => { editing.current = false; if (!cancelled.current) commit() }}
    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); editing.current = false; commit() } if (event.key === "Escape") { event.preventDefault(); cancelled.current = true; setDraft(String(value)); event.currentTarget.blur() } }} />
}
