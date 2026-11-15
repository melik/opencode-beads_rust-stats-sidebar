import assert from "node:assert/strict"
import { describe, test } from "node:test"
import {
  classifyTaskStatus,
  hiddenSnapshot,
  parseSnapshot,
  readSnapshot,
} from "./beads.ts"

const stats = JSON.stringify({ summary: { total_issues: 12, open_issues: 4, in_progress_issues: 2, blocked_issues: 1, closed_issues: 5 } })
const epics = JSON.stringify([
  { epic: { id: "epic-1", title: "Epic One", status: "open" }, total_children: 3, closed_children: 1, eligible_for_close: true },
  { epic: { id: "epic-2", title: "Epic Two", status: "open" }, total_children: 1, closed_children: 0, eligible_for_close: false },
])
const ready = JSON.stringify([
  { id: "epic-1.1", title: "Ready child", status: "open" },
])
const emptyReady = JSON.stringify([])
const emptyIssues = JSON.stringify({ issues: [] })
const inProgress = JSON.stringify({
  issues: [{ id: "task-1", title: "Active task", status: "in_progress", updated_at: "2026-01-01T00:00:00Z" }],
})
const workspaceInProgress = JSON.stringify({
  issues: [
    { id: "task-old", title: "Old task", status: "in_progress", updated_at: "2026-01-01T00:00:00Z" },
    { id: "task-new", title: "New task", status: "in_progress", updated_at: "2026-03-01T00:00:00Z" },
  ],
})
const closed = JSON.stringify({ issues: [
  { id: "closed-old", title: "Old closed", status: "closed", updated_at: "2026-01-01T00:00:00Z" },
  { id: "closed-new", title: "New closed", status: "closed", updated_at: "2026-02-01T00:00:00Z" },
] })
const epicOneShow = JSON.stringify([{
  id: "epic-1",
  title: "Epic One",
  dependents: [
    { id: "epic-1.1", title: "Ready child", status: "open", dependency_type: "parent-child" },
    { id: "epic-1.2", title: "Blocked child", status: "open", dependency_type: "parent-child" },
    { id: "epic-1.3", title: "Closed child", status: "closed", dependency_type: "parent-child" },
    { id: "other", title: "Not a child", status: "open", dependency_type: "blocks" },
  ],
}])
const epicTwoShow = JSON.stringify([{
  id: "epic-2",
  title: "Epic Two",
  dependents: [
    { id: "task-1", title: "Active task", status: "in_progress", dependency_type: "parent-child" },
  ],
}])

type StubData = {
  epics?: string
  ready?: string
  inProgress?: string
  closed?: string
  show?: Record<string, string>
}

function stub(data: StubData = {}, calls: string[] = []) {
  return async (directory: string, args: readonly string[]) => {
    assert.equal(directory, "/project")
    calls.push(args.join(" "))
    if (args[0] === "stats") return stats
    if (args[0] === "epic") return data.epics ?? epics
    if (args[0] === "ready") return data.ready ?? emptyReady
    if (args[0] === "list") {
      return args.includes("closed") ? data.closed ?? emptyIssues : data.inProgress ?? emptyIssues
    }
    if (args[0] === "show") {
      const response = data.show?.[args[1]]
      if (response !== undefined) return response
    }
    throw new Error(`Unexpected br command: ${args.join(" ")}`)
  }
}

describe("Beads sidebar snapshot", () => {
  test("reads counters from the stats summary", () => {
    assert.deepEqual(parseSnapshot(stats), {
      available: true,
      total: 12,
      open: 4,
      inProgress: 2,
      blocked: 1,
      closed: 5,
      epicsReady: 0,
    })
  })

  test("uses the five read-only br commands in the project directory", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({}, calls))
    assert.equal(snapshot.available, true)
    assert.equal(snapshot.epicsReady, 1)
    assert.equal(snapshot.plan, undefined)
    assert.deepEqual(calls.sort(), [
      "epic status --json",
      "list --status closed --json",
      "list --status in_progress --json",
      "ready --json",
      "stats --json --no-activity",
    ])
  })

  test("counts ready-to-close epics from eligible flags in the epic list", () => {
    assert.equal(parseSnapshot(stats, epics).epicsReady, 1)
    assert.equal(parseSnapshot(stats, "[]").epicsReady, 0)
    assert.equal(parseSnapshot(stats, JSON.stringify([{ epic: { id: "epic-3", title: "Epic Three", status: "open" }, eligible_for_close: false }])).epicsReady, 0)
  })

  test("keeps stats when the epic request fails or returns invalid data", async () => {
    const failing = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      throw new Error("epic status unsupported")
    })
    assert.equal(failing.available, true)
    assert.equal(failing.epicsReady, 0)
    assert.equal(failing.plan, undefined)

    const invalid = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      return "not json"
    })
    assert.equal(invalid.available, true)
    assert.equal(invalid.epicsReady, 0)
    assert.equal(invalid.plan, undefined)

    const notArray = parseSnapshot(stats, "{}")
    assert.equal(notArray.available, true)
    assert.equal(notArray.epicsReady, 0)
  })

  test("hides missing Beads and invalid responses", async () => {
    assert.deepEqual(await readSnapshot("/project", undefined, async () => {
      throw new Error("Beads not initialized")
    }), hiddenSnapshot())
    assert.deepEqual(await readSnapshot("/project", undefined, async () => "not json"), hiddenSnapshot())
    assert.throws(() => parseSnapshot("{}"), /Invalid br/)
  })

  test("prefers the most recent in-progress task over recently closed tasks", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({
      ready,
      inProgress: workspaceInProgress,
      closed,
      show: { "task-new": JSON.stringify([{ id: "task-new", title: "New task" }]) },
    }, calls))

    assert.deepEqual(snapshot.plan, {
      kind: "task",
      tasks: [{ id: "task-new", title: "New task", status: "in_progress" }],
    })
    assert.deepEqual(calls.slice(5), ["show task-new --json"])
  })

  test("falls back to the most recent closed task when nothing is in progress", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({
      ready,
      inProgress: emptyIssues,
      closed,
      show: { "closed-new": JSON.stringify([{ id: "closed-new", title: "New closed" }]) },
    }, calls))

    assert.deepEqual(snapshot.plan, {
      kind: "task",
      tasks: [{ id: "closed-new", title: "New closed", status: "closed" }],
    })
    assert.deepEqual(calls.slice(5), ["show closed-new --json"])
  })

  test("shows the epic of the most recently closed task", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({
      ready,
      inProgress: emptyIssues,
      closed,
      show: {
        "closed-new": JSON.stringify([{ id: "closed-new", title: "New closed", parent: "epic-1" }]),
        "epic-1": epicOneShow,
      },
    }, calls))

    assert.deepEqual(snapshot.plan, {
      kind: "epic",
      epicId: "epic-1",
      epicTitle: "Epic One",
      done: 1,
      total: 3,
      percent: 33,
      tasks: [
        { id: "epic-1.1", title: "Ready child", status: "ready" },
        { id: "epic-1.2", title: "Blocked child", status: "blocked" },
        { id: "epic-1.3", title: "Closed child", status: "closed" },
      ],
    })
    assert.deepEqual(calls.slice(5), ["show closed-new --json", "show epic-1 --json"])
  })

  test("shows the epic of the most recent in-progress task", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({
      ready: emptyReady,
      inProgress,
      closed: emptyIssues,
      show: {
        "task-1": JSON.stringify([{ id: "task-1", title: "Active task", parent: "epic-2" }]),
        "epic-2": epicTwoShow,
      },
    }, calls))

    assert.equal(snapshot.plan?.kind, "epic")
    assert.equal(snapshot.plan?.epicId, "epic-2")
    assert.deepEqual(snapshot.plan?.tasks, [{ id: "task-1", title: "Active task", status: "in_progress" }])
    assert.deepEqual(calls.slice(5), ["show task-1 --json", "show epic-2 --json"])
  })

  test("shows the epic block when br list omits the parent but br show provides it", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({
      ready: emptyReady,
      inProgress: JSON.stringify({
        issues: [{ id: "task-1", title: "Active task", status: "in_progress", updated_at: "2026-01-01T00:00:00Z" }],
      }),
      closed: emptyIssues,
      show: {
        "task-1": JSON.stringify([{ id: "task-1", title: "Active task", parent: "epic-2" }]),
        "epic-2": epicTwoShow,
      },
    }, calls))

    assert.equal(snapshot.plan?.kind, "epic")
    assert.equal(snapshot.plan?.epicId, "epic-2")
    assert.equal(snapshot.plan?.epicTitle, "Epic Two")
    assert.deepEqual(snapshot.plan?.tasks, [{ id: "task-1", title: "Active task", status: "in_progress" }])
    assert.deepEqual(calls.slice(5), ["show task-1 --json", "show epic-2 --json"])
  })

  test("shows a single row when the current task has no parent epic", async () => {
    const closedCalls: string[] = []
    const closedSnapshot = await readSnapshot("/project", undefined, stub({
      ready: emptyReady,
      inProgress: emptyIssues,
      closed,
      show: { "closed-new": JSON.stringify([{ id: "closed-new", title: "New closed" }]) },
    }, closedCalls))
    assert.deepEqual(closedSnapshot.plan, {
      kind: "task",
      tasks: [{ id: "closed-new", title: "New closed", status: "closed" }],
    })
    assert.deepEqual(closedCalls.slice(5), ["show closed-new --json"])

    const inProgressCalls: string[] = []
    const inProgressSnapshot = await readSnapshot("/project", undefined, stub({
      ready: emptyReady,
      inProgress: workspaceInProgress,
      closed: emptyIssues,
      show: { "task-new": JSON.stringify([{ id: "task-new", title: "New task" }]) },
    }, inProgressCalls))
    assert.deepEqual(inProgressSnapshot.plan, {
      kind: "task",
      tasks: [{ id: "task-new", title: "New task", status: "in_progress" }],
    })
    assert.deepEqual(inProgressCalls.slice(5), ["show task-new --json"])
  })

  test("shows no plan when there is neither a closed nor an in-progress task", async () => {
    const calls: string[] = []
    const snapshot = await readSnapshot("/project", undefined, stub({}, calls))
    assert.equal(snapshot.available, true)
    assert.equal(snapshot.plan, undefined)
    assert.deepEqual(calls.slice(5), [])
  })

  test("keeps the in-progress current task when the closed list is malformed or unavailable", async () => {
    const malformed = await readSnapshot("/project", undefined, stub({
      ready: emptyReady,
      inProgress: workspaceInProgress,
      closed: "not json",
      show: { "task-new": JSON.stringify([{ id: "task-new", title: "New task" }]) },
    }))
    assert.deepEqual(malformed.plan, {
      kind: "task",
      tasks: [{ id: "task-new", title: "New task", status: "in_progress" }],
    })

    const unavailable = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      if (args[0] === "epic") return epics
      if (args[0] === "ready") return emptyReady
      if (args[0] === "list" && args.includes("closed")) throw new Error("closed unsupported")
      if (args[0] === "list") return workspaceInProgress
      if (args[0] === "show") return JSON.stringify([{ id: args[1], title: "New task" }])
      throw new Error(`Unexpected br command: ${args.join(" ")}`)
    })
    assert.deepEqual(unavailable.plan, {
      kind: "task",
      tasks: [{ id: "task-new", title: "New task", status: "in_progress" }],
    })
  })

  test("resolves open tasks as ready or blocked against the ready list", () => {
    const readyIds = new Set(["ready-1"])
    assert.equal(classifyTaskStatus("open", "ready-1", readyIds), "ready")
    assert.equal(classifyTaskStatus("open", "blocked-1", readyIds), "blocked")
    assert.equal(classifyTaskStatus("closed", "closed-1", readyIds), "closed")
    assert.equal(classifyTaskStatus("in_progress", "active-1", readyIds), "in_progress")
    assert.equal(classifyTaskStatus("deferred", "deferred-1", readyIds), "deferred")
    assert.equal(classifyTaskStatus("blocked", "blocked-1", readyIds), "blocked")
  })

  test("keeps stats but omits the plan when plan data fails", async () => {
    const failingReady = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      if (args[0] === "epic") return epics
      if (args[0] === "ready") throw new Error("ready unsupported")
      if (args[0] === "list") return emptyIssues
      throw new Error(`Unexpected br command: ${args.join(" ")}`)
    })
    assert.equal(failingReady.available, true)
    assert.equal(failingReady.plan, undefined)

    const failingInProgress = await readSnapshot("/project", undefined, async (directory, args) => {
      if (args[0] === "stats") return stats
      if (args[0] === "epic") return epics
      if (args[0] === "ready") return emptyReady
      if (args[0] === "list" && args.includes("in_progress")) throw new Error("list unsupported")
      if (args[0] === "list") return emptyIssues
      throw new Error(`Unexpected br command: ${args.join(" ")}`)
    })
    assert.equal(failingInProgress.available, true)
    assert.equal(failingInProgress.plan, undefined)

    const malformedEpic = await readSnapshot("/project", undefined, stub({
      ready,
      inProgress,
      closed: emptyIssues,
      show: {
        "task-1": JSON.stringify([{ id: "task-1", title: "Active task", parent: "epic-2" }]),
        "epic-2": "not json",
      },
    }))
    assert.equal(malformedEpic.available, true)
    assert.equal(malformedEpic.plan, undefined)
  })
})
