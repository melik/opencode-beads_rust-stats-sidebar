import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { progressBar, statisticLine } from "./display.ts"

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
})
