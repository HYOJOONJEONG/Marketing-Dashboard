"use client"

import { useEffect } from "react"

const MONTH_LABEL_PATTERN = /^(구분\(월\)|[1-9]월|1[0-2]월|합계)$/
const ACTION_LABEL_PATTERN = /(작업|수정|삭제|저장|관리)/
const REPORT_CLASS_PATTERN = /(weekly-report-table|report-table|summary-table|print-|pdf-)/

function cleanLabel(value: string, index: number) {
  const label = value.replace(/\s+/g, " ").trim()
  return label || `항목 ${index + 1}`
}

function getTableHeaders(table: HTMLTableElement) {
  const headRows = table.tHead ? Array.from(table.tHead.rows) : []
  const headerCells =
    headRows.length > 0
      ? Array.from(headRows[headRows.length - 1].cells)
      : Array.from(table.querySelectorAll<HTMLTableCellElement>("tr:first-child th"))

  return headerCells.map((cell, index) => cleanLabel(cell.textContent || "", index))
}

function shouldKeepScrollable(table: HTMLTableElement, headers: string[]) {
  const className = typeof table.className === "string" ? table.className : ""
  const monthCount = headers.filter((header) => MONTH_LABEL_PATTERN.test(header)).length
  const hasActionColumn = headers.some((header) => ACTION_LABEL_PATTERN.test(header))
  const inputCount = table.querySelectorAll("input, textarea, select").length

  return (
    REPORT_CLASS_PATTERN.test(className) ||
    monthCount >= 4 ||
    (headers.length >= 12 && !hasActionColumn) ||
    (monthCount >= 2 && inputCount >= 8)
  )
}

function annotateCells(table: HTMLTableElement, headers: string[]) {
  const bodyRows = table.tBodies.length
    ? Array.from(table.tBodies).flatMap((tbody) => Array.from(tbody.rows))
    : Array.from(table.rows).slice(1)

  bodyRows.forEach((row) => {
    Array.from(row.cells).forEach((cell, index) => {
      const label = cleanLabel(headers[index] || headers[headers.length - 1] || "", index)
      cell.dataset.mobileLabel = label

      const hasInteractiveContent = Boolean(cell.querySelector("a, button, input, select, textarea, [role='button']"))
      if (!hasInteractiveContent && !cell.textContent?.trim()) {
        cell.dataset.mobileEmpty = "true"
      } else {
        delete cell.dataset.mobileEmpty
      }
    })
  })
}

function enhanceTable(table: HTMLTableElement) {
  if (table.closest("[data-mobile-table-skip='true']")) return

  const headers = getTableHeaders(table)
  if (headers.length === 0) return

  const keepScrollable = shouldKeepScrollable(table, headers)
  table.classList.toggle("mobile-scroll-table", keepScrollable)
  table.classList.toggle("mobile-card-table", !keepScrollable)
  table.dataset.mobileEnhanced = "true"

  const wrapper = table.parentElement
  if (wrapper) {
    wrapper.classList.add("mobile-table-viewport")
  }

  annotateCells(table, headers)
}

export function MobileTableEnhancer() {
  useEffect(() => {
    let frame = 0

    const enhanceAllTables = () => {
      frame = 0
      document.querySelectorAll<HTMLTableElement>("table").forEach(enhanceTable)
    }

    const scheduleEnhancement = () => {
      if (frame) return
      frame = window.requestAnimationFrame(enhanceAllTables)
    }

    scheduleEnhancement()

    const observer = new MutationObserver(scheduleEnhancement)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", scheduleEnhancement)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", scheduleEnhancement)
    }
  }, [])

  return null
}
