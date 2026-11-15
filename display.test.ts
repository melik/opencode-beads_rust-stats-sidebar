import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { epicSummaryLine, progressBar, statisticLine, statusGlyph, taskLine } from "./display.ts"

describe("Beads statistics display", () => {
  test("renders ten cells and rounds filled cells and percentages", () => {
    assert.equal(progressBar(11, 18), "■■■■■■□□□□")
    assert.equal(progressBar(1, 18), "■□□□□□□□□□")
    assert.equal(statisticLine("Open", 11, 18, 11), "Open        ■■■■■■□□□□ 11 (61%)")
    assert.equal(statisticLine("In progress", 1, 18, 11), "In progress ■□□□□□□□□□ 1 (6%)")
  })

  test("handles zero and limits overfilled bars", () => {
    assert.equal(statisticLine("Blocked", 0, 0, 7), "Blocked □□□□□□□□□□ 0 (0%)")
    assert.equal(progressBar(10, 3), "■".repeat(10))
    assert.equal(statisticLine("Closed", 10, 3, 6), "Closed ■■■■■■■■■■ 10 (333%)")
  })

  test("maps task statuses to glyphs", () => {
    assert.equal(statusGlyph("closed"), "✓")
    assert.equal(statusGlyph("in_progress"), "◐")
    assert.equal(statusGlyph("ready"), "○")
    assert.equal(statusGlyph("blocked"), "●")
    assert.equal(statusGlyph("deferred"), "❄")
  })

  test("renders the epic summary and task lines", () => {
    assert.equal(epicSummaryLine("rtr-e6", 5, 11), "▼ rtr-e6 45% (5/11)")
    assert.equal(epicSummaryLine("epic-1", 0, 0), "▼ epic-1 0% (0/0)")
    assert.equal(taskLine("ready", "Do work"), "[○] Do work")
    assert.equal(taskLine("closed", "Done work"), "[✓] Done work")
  })
})
