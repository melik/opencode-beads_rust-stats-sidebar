import type { PlanTaskStatus } from "./beads.js"

const statusGlyphs: Record<PlanTaskStatus, string> = {
  closed: "✓",
  in_progress: "◐",
  ready: "○",
  blocked: "●",
  deferred: "❄",
}

export function statusGlyph(status: PlanTaskStatus): string {
  return statusGlyphs[status]
}

export function epicSummaryLine(epicId: string, done: number, total: number): string {
  const percent = total === 0 ? 0 : Math.round(done / total * 100)
  return `▼ ${epicId} ${percent}% (${done}/${total})`
}

export function taskLine(status: PlanTaskStatus, title: string): string {
  return `[${statusGlyph(status)}] ${title}`
}

export function progressBar(value: number, total: number): string {
  if (total === 0) return "□".repeat(10)
  const filled = Math.max(0, Math.min(10, Math.round(value / total * 10)))
  return "■".repeat(filled) + "□".repeat(10 - filled)
}

export function statisticLine(label: string, value: number, total: number, labelWidth: number): string {
  const percent = total === 0 ? 0 : Math.round(value / total * 100)
  return `${label.padEnd(labelWidth)} ${progressBar(value, total)} ${value} (${percent}%)`
}
