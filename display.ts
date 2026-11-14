export function progressBar(value: number, total: number): string {
  if (total === 0) return "□".repeat(10)
  const filled = Math.max(0, Math.min(10, Math.round(value / total * 10)))
  return "■".repeat(filled) + "□".repeat(10 - filled)
}

export function statisticLine(label: string, value: number, total: number, labelWidth: number): string {
  const percent = total === 0 ? 0 : Math.round(value / total * 100)
  return `${label.padEnd(labelWidth)} ${progressBar(value, total)} ${value} (${percent}%)`
}
