import * as Y from "yjs"
import { DocumentReport, legacyReportContent, reportFields, RichReportNode, validRichContent } from "./document-report"
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap"
import { reportSchema } from "./document-rich-schema"

export function initializeRichDocument(doc: Y.Doc) {
  if (doc.getMap("report").get("richInitialized")) return false
  const content = legacyReportContent(reportFromYDoc(doc))
  doc.transact(() => {
    prosemirrorJSONToYXmlFragment(reportSchema(), content, doc.getXmlFragment("rich-text"))
    doc.getMap("report").set("richInitialized", true)
  }, "local")
  return true
}

export function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}
export function base64ToBytes(value: string) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"))
  return Uint8Array.from(atob(value), character => character.charCodeAt(0))
}

function updateText(text: Y.Text, value: string) {
  const before = text.toString()
  if (before === value) return
  let prefix = 0
  while (prefix < before.length && prefix < value.length && before[prefix] === value[prefix]) prefix++
  let suffix = 0
  while (suffix < before.length - prefix && suffix < value.length - prefix && before[before.length - 1 - suffix] === value[value.length - 1 - suffix]) suffix++
  text.delete(prefix, before.length - prefix - suffix)
  text.insert(prefix, value.slice(prefix, value.length - suffix))
}

export function applyReportChange(doc: Y.Doc, next: DocumentReport, previous?: DocumentReport | null) {
  const previousKeys = new Set(previous ? reportFields(previous).map(field => field.key) : [])
  doc.transact(() => {
    const root = doc.getMap<any>("report")
    if (next.richText && JSON.stringify(next.richText) !== JSON.stringify(previous?.richText)) {
      prosemirrorJSONToYXmlFragment(reportSchema(), next.richText, doc.getXmlFragment("rich-text"))
      root.set("richInitialized", true)
    } else if (previous?.richText && !next.richText) {
      prosemirrorJSONToYXmlFragment(reportSchema(), legacyReportContent(next), doc.getXmlFragment("rich-text"))
    }
    for (const key of ["title", "date", "author"] as const) {
      if (!previous || next[key] !== previous[key]) updateText(doc.getText(key), next[key])
    }
    if (!previous || JSON.stringify(next.sections) !== JSON.stringify(previous.sections)) {
      root.set("sections", next.sections)
    }
    const styles = doc.getMap("styles")
    for (const field of reportFields(next)) {
      const before = previous?.fields?.[field.key]
      const after = next.fields?.[field.key]
      const text = doc.getText(`field:${field.key}`)
      if (!previous || after?.text !== before?.text || !previousKeys.has(field.key)) updateText(text, after?.text ?? field.text)
      const oldStyle = before?.style || {}
      const newStyle = after?.style || {}
      for (const property of new Set([...Object.keys(oldStyle), ...Object.keys(newStyle)])) {
        const key = property as keyof typeof newStyle
        if (newStyle[key] === oldStyle[key]) continue
        if (newStyle[key] == null) styles.delete(`${field.key}/${property}`)
        else styles.set(`${field.key}/${property}`, newStyle[key])
      }
    }
    for (const key of ["margin", "logoWidth"] as const) {
      if (!previous || next.page?.[key] !== previous.page?.[key]) {
        if (next.page?.[key] == null) root.delete(key)
        else root.set(key, next.page[key])
      }
    }
  }, "local")
}

export function reportFromYDoc(doc: Y.Doc): DocumentReport {
  const root = doc.getMap<any>("report")
  const report: DocumentReport = {
    title: doc.getText("title").toString(), date: doc.getText("date").toString(), author: doc.getText("author").toString(),
    sections: root.get("sections") || [], fields: {}, page: { margin: root.get("margin"), logoWidth: root.get("logoWidth") },
  }
  const styles = doc.getMap("styles")
  for (const field of reportFields(report)) {
    const text = doc.getText(`field:${field.key}`)
    const style: Record<string, unknown> = {}
    for (const [key, value] of styles.entries()) if (key.startsWith(`${field.key}/`)) style[key.slice(field.key.length + 1)] = value
    report.fields![field.key] = { text: text.toString(), style }
  }
  if (root.get("richInitialized")) {
    const richText = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("rich-text")) as RichReportNode
    report.richText = richText
    const heading = richText.content?.find(node => node.type === "heading" && node.attrs?.level === 1)
    const title = heading?.content?.map(node => node.text || "").join("")
    if (title) report.fields!.title = { ...report.fields!.title, text: title }
  }
  return report
}

export type DocumentMember = { userId: string; name: string; role: "editor" | "viewer" }
export type DocumentPresence = { userId: string; name: string; field: string; seenAt: number; connectionId: string }
export type StoredDocument = {
  id: string; ownerId: string; ownerName: string; title: string; members: DocumentMember[]
  createdAt: string; updatedAt: string; version: number; state: string; presence: DocumentPresence[]
}
export function documentRole(document: StoredDocument, userId: string) {
  if (document.ownerId === userId) return "owner" as const
  return document.members.find(member => member.userId === userId)?.role || null
}
export function validateReport(report: unknown): report is DocumentReport {
  if (!report || typeof report !== "object") return false
  const value = report as DocumentReport
  return typeof value.title === "string" && value.title.length <= 1000 && typeof value.author === "string" && typeof value.date === "string" &&
    Array.isArray(value.sections) && value.sections.length <= 200 && value.sections.every(section => typeof section.heading === "string" && typeof section.content === "string") &&
    (!value.richText || value.richText.type === "doc" && validRichContent(value.richText)) && JSON.stringify(value).length <= 500000
}
