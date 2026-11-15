import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type PlanTaskStatus = "closed" | "in_progress" | "ready" | "blocked" | "deferred"

export type PlanTask = {
  id: string
  title: string
  status: PlanTaskStatus
}

export type SnapshotPlan = {
  kind: "epic" | "task"
  epicId?: string
  epicTitle?: string
  done?: number
  total?: number
  percent?: number
  tasks: PlanTask[]
}

export type Snapshot = {
  available: boolean
  total: number
  open: number
  inProgress: number
  blocked: number
  closed: number
  epicsReady: number
  plan?: SnapshotPlan
}

export type EpicStatus = {
  id: string
  title: string
  status: string
  eligibleForClose: boolean
}

export type InProgressTask = {
  id: string
  title: string
  updatedAt: number
}

export type BrRunner = (directory: string, args: readonly string[], signal?: AbortSignal) => Promise<string>

export function hiddenSnapshot(): Snapshot {
  return { available: false, total: 0, open: 0, inProgress: 0, blocked: 0, closed: 0, epicsReady: 0 }
}

const runBr: BrRunner = async (directory, args, signal) => {
  const result = await execFileAsync("br", [...args], {
    cwd: directory,
    encoding: "utf8",
    signal,
    timeout: 5000,
    maxBuffer: 4 * 1024 * 1024,
  })
  return result.stdout
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid br response")
  return value as Record<string, unknown>
}

function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error("Invalid br count")
  return value
}

function text(value: unknown): string {
  if (typeof value !== "string") throw new Error("Invalid br text")
  return value
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined
  return text(value)
}

function parseParent(issueJson: string): string | undefined {
  const shown = JSON.parse(issueJson)
  if (!Array.isArray(shown) || shown.length === 0) throw new Error("Invalid br show")
  return optionalText(record(shown[0]).parent)
}

export function parseEpicStatus(epicStatusJson: string): EpicStatus[] {
  const epics = JSON.parse(epicStatusJson)
  if (!Array.isArray(epics)) throw new Error("Invalid br epic status")
  return epics.map((value) => {
    const entry = record(value)
    const epic = record(entry.epic)
    return {
      id: text(epic.id),
      title: text(epic.title),
      status: text(epic.status),
      eligibleForClose: entry.eligible_for_close === true,
    }
  })
}

function parseEpicCount(epicStatusJson: string | undefined): number {
  if (epicStatusJson === undefined) return 0
  try {
    return parseEpicStatus(epicStatusJson).filter((epic) => epic.eligibleForClose).length
  } catch {
    return 0
  }
}

function parseIssueList(listJson: string): InProgressTask[] {
  const issues = record(JSON.parse(listJson)).issues
  if (!Array.isArray(issues)) throw new Error("Invalid br issue list")
  return issues.map((value) => {
    const issue = record(value)
    const updatedAt = typeof issue.updated_at === "string" ? Date.parse(issue.updated_at) : Number.NaN
    return {
      id: text(issue.id),
      title: text(issue.title),
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    }
  })
}

function parseReadyTasks(readyJson: string): Array<{ id: string; title: string }> {
  const issues = JSON.parse(readyJson)
  if (!Array.isArray(issues)) throw new Error("Invalid br ready list")
  return issues.map((value) => {
    const issue = record(value)
    return { id: text(issue.id), title: text(issue.title) }
  })
}

function byUpdatedAtDescending(left: InProgressTask, right: InProgressTask): number {
  return right.updatedAt - left.updatedAt
}

function parseRecentClosed(closedJson: string | null): InProgressTask | undefined {
  if (closedJson === null) return undefined
  try {
    return parseIssueList(closedJson).sort(byUpdatedAtDescending)[0]
  } catch {
    return undefined
  }
}

export function classifyTaskStatus(status: string, id: string, readyIds: ReadonlySet<string>): PlanTaskStatus {
  switch (status) {
    case "closed":
      return "closed"
    case "in_progress":
      return "in_progress"
    case "deferred":
      return "deferred"
    case "blocked":
      return "blocked"
    case "open":
      return readyIds.has(id) ? "ready" : "blocked"
    default:
      return "blocked"
  }
}

function parseEpicTasks(epicJson: string, readyIds: ReadonlySet<string>): PlanTask[] {
  const shown = JSON.parse(epicJson)
  if (!Array.isArray(shown) || shown.length === 0) throw new Error("Invalid br epic show")
  const dependents = record(shown[0]).dependents
  if (!Array.isArray(dependents)) throw new Error("Invalid br epic dependents")

  return dependents.flatMap((value) => {
    const dependent = record(value)
    if (dependent.dependency_type !== "parent-child") return []
    const id = text(dependent.id)
    return [{
      id,
      title: text(dependent.title),
      status: classifyTaskStatus(text(dependent.status), id, readyIds),
    }]
  })
}

function required(value: string | null): string {
  if (value === null) throw new Error("Missing br data")
  return value
}

async function readPlan(
  directory: string,
  signal: AbortSignal | undefined,
  run: BrRunner,
  data: {
    epicStatusJson: string | null
    readyJson: string | null
    inProgressJson: string | null
    closedJson: string | null
  },
): Promise<SnapshotPlan | undefined> {
  const epics = parseEpicStatus(required(data.epicStatusJson))
  const ready = parseReadyTasks(required(data.readyJson))
  const readyIds = new Set(ready.map((task) => task.id))
  const inProgress = parseIssueList(required(data.inProgressJson))
  const recentClosed = parseRecentClosed(data.closedJson)
  const recentInProgress = [...inProgress].sort(byUpdatedAtDescending)[0]
  const currentTask = recentInProgress ?? recentClosed
  if (!currentTask) return undefined

  let parentId: string | undefined
  try {
    parentId = parseParent(await run(directory, ["show", currentTask.id, "--json"], signal))
  } catch {
    parentId = undefined
  }
  const focus = parentId ? epics.find((epic) => epic.id === parentId) : undefined
  if (!focus) {
    return {
      kind: "task",
      tasks: [{
        id: currentTask.id,
        title: currentTask.title,
        status: currentTask === recentClosed ? "closed" : "in_progress",
      }],
    }
  }

  const tasks = parseEpicTasks(await run(directory, ["show", focus.id, "--json"], signal), readyIds)
  const done = tasks.filter((task) => task.status === "closed").length
  const total = tasks.length

  return {
    kind: "epic",
    epicId: focus.id,
    epicTitle: focus.title,
    done,
    total,
    percent: total === 0 ? 0 : Math.round(done / total * 100),
    tasks,
  }
}

export function parseSnapshot(statsJson: string, epicStatusJson?: string): Snapshot {
  const summary = record(record(JSON.parse(statsJson)).summary)

  return {
    available: true,
    total: count(summary.total_issues),
    open: count(summary.open_issues),
    inProgress: count(summary.in_progress_issues),
    blocked: count(summary.blocked_issues),
    closed: count(summary.closed_issues),
    epicsReady: parseEpicCount(epicStatusJson),
  }
}

export async function readSnapshot(
  directory: string,
  signal?: AbortSignal,
  run: BrRunner = runBr,
): Promise<Snapshot> {
  try {
    const [stats, epics, ready, inProgress, closed] = await Promise.all([
      run(directory, ["stats", "--json", "--no-activity"], signal),
      run(directory, ["epic", "status", "--json"], signal).catch(() => null),
      run(directory, ["ready", "--json"], signal).catch(() => null),
      run(directory, ["list", "--status", "in_progress", "--json"], signal).catch(() => null),
      run(directory, ["list", "--status", "closed", "--json"], signal).catch(() => null),
    ])
    const snapshot = parseSnapshot(stats, epics ?? undefined)
    try {
      const plan = await readPlan(directory, signal, run, { epicStatusJson: epics, readyJson: ready, inProgressJson: inProgress, closedJson: closed })
      if (plan) snapshot.plan = plan
    } catch {
      // Plan data is optional: keep the statistics visible when it cannot be built.
    }
    return snapshot
  } catch {
    return hiddenSnapshot()
  }
}
