import assert from "node:assert/strict"
import { describe, test } from "node:test"
import { hiddenSnapshot, parseSnapshot, readSnapshot } from "./beads.ts"

const stats = JSON.stringify({ summary: { total_issues: 12, open_issues: 4, in_progress_issues: 2, blocked_issues: 1, closed_issues: 5 } })
const issue = {
  id: "br-old",
  title: "Older task",
  description: "Older description",
  dependent_count: 1,
  updated_at: "2026-11-09T10:00:00Z",
}
const latest = {
  id: "br-current",
  title: "Current task",
  description: "Current description",
  dependent_count: 3,
  updated_at: "2026-11-10T10:00:00Z",
}

describe("Beads sidebar snapshot", () => {
  test("reads counters and exposes a description only for one in-progress task", () => {
    assert.deepEqual(parseSnapshot(stats, JSON.stringify({ issues: [latest] })), {
      available: true,
      total: 12,
      open: 4,
      inProgress: 2,
      blocked: 1,
      closed: 5,
      epicsReady: 0,
      tasks: [
        { id: "br-current", title: "Current task", description: "Current description" },
      ],
      current: {
        id: "br-current",
        title: "Current task",
        description: "Current description",
      },
    })
  })

  test("supports no active task and an empty description", () => {
    assert.deepEqual(parseSnapshot(stats, JSON.stringify({ issues: [] })), {
      available: true,
      total: 12,
      open: 4,
      inProgress: 2,
      blocked: 1,
      closed: 5,
      epicsReady: 0,
      tasks: [],
      current: null,
    })
    assert.equal(parseSnapshot(stats, JSON.stringify({ issues: [{ ...latest, description: null }] })).current?.description, null)
  })

  test("keeps multiple active tasks as a list without a description target", () => {
    const snapshot = parseSnapshot(stats, JSON.stringify({ issues: [issue, latest] }))
    assert.equal(snapshot.current, null)
    assert.deepEqual(snapshot.tasks.map((task) => `${task.id} - ${task.title}`), [
      "br-current - Current task",
      "br-old - Older task",
    ])
  })

  test("uses the three read-only br commands in the project directory", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, async (directory, args) => {
      assert.equal(directory, "/project")
      calls.push(args.join(" "))
      if (args[0] === "stats") return stats
      if (args[0] === "epic") return JSON.stringify([{ id: "epic-1" }, { id: "epic-2" }])
      return JSON.stringify({ issues: [latest] })
    })
    assert.equal(snapshot.available, true)
    assert.equal(snapshot.epicsReady, 2)
    assert.deepEqual(calls.sort(), [
      "epic status --eligible-only --json",
      "list --status in_progress --json",
      "stats --json --no-activity",
    ])
  })

  test("counts ready-to-close epics from the eligible-only list", () => {
    const epics = JSON.stringify([{ id: "epic-1" }, { id: "epic-2" }])
    const snapshot = parseSnapshot(stats, JSON.stringify({ issues: [latest] }), epics)
    assert.equal(snapshot.epicsReady, 2)
    assert.equal(parseSnapshot(stats, JSON.stringify({ issues: [] }), "[]").epicsReady, 0)
  })

  test("keeps stats and tasks when the epic request fails or returns invalid data", async () => {
    const failing = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      if (args[0] === "epic") throw new Error("epic status unsupported")
      return JSON.stringify({ issues: [latest] })
    })
    assert.equal(failing.available, true)
    assert.equal(failing.epicsReady, 0)
    assert.equal(failing.tasks.length, 1)

    const invalid = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      if (args[0] === "epic") return "not json"
      return JSON.stringify({ issues: [latest] })
    })
    assert.equal(invalid.available, true)
    assert.equal(invalid.epicsReady, 0)

    const notArray = parseSnapshot(stats, JSON.stringify({ issues: [] }), "{}")
    assert.equal(notArray.available, true)
    assert.equal(notArray.epicsReady, 0)
  })

  test("hides missing Beads and invalid responses", async () => {
    assert.deepEqual(await readSnapshot("/project", undefined, async () => {
      throw new Error("Beads not initialized")
    }), hiddenSnapshot())
    assert.deepEqual(await readSnapshot("/project", undefined, async () => "not json"), hiddenSnapshot())
    assert.throws(() => parseSnapshot("{}", "{}"), /Invalid br/)
  })
})
