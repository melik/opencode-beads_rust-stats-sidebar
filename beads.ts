import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type CurrentTask = {
  id: string
  title: string
  description: string | null
}

export type Snapshot = {
  available: boolean
  total: number
  open: number
  inProgress: number
  blocked: number
  closed: number
  epicsReady: number
  tasks: CurrentTask[]
  current: CurrentTask | null
}

export type BrRunner = (directory: string, args: readonly string[], signal?: AbortSignal) => Promise<string>

export function hiddenSnapshot(): Snapshot {
  return { available: false, total: 0, open: 0, inProgress: 0, blocked: 0, closed: 0, epicsReady: 0, tasks: [], current: null }
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

function parseTask(value: unknown) {
  const issue = record(value)
  const description = issue.description
  if (description !== null && description !== undefined && typeof description !== "string") {
    throw new Error("Invalid br description")
  }
  const updatedAt = Date.parse(text(issue.updated_at))
  if (!Number.isFinite(updatedAt)) throw new Error("Invalid br update time")
  return {
    id: text(issue.id),
    title: text(issue.title),
    description: description ?? null,
    updatedAt,
  }
}

function parseEpicCount(epicStatusJson: string | undefined): number {
  if (epicStatusJson === undefined) return 0
  try {
    const epics = JSON.parse(epicStatusJson)
    if (!Array.isArray(epics)) throw new Error("Invalid br epic status")
    return epics.length
  } catch {
    return 0
  }
}

export function parseSnapshot(statsJson: string, listJson: string, epicStatusJson?: string): Snapshot {
  const summary = record(record(JSON.parse(statsJson)).summary)
  const issues = record(JSON.parse(listJson)).issues
  if (!Array.isArray(issues)) throw new Error("Invalid br issue list")

  const tasks = issues.map(parseTask)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map(({ id, title, description }) => ({ id, title, description }))
  const current = tasks.length === 1 ? tasks[0] : null

  return {
    available: true,
    total: count(summary.total_issues),
    open: count(summary.open_issues),
    inProgress: count(summary.in_progress_issues),
    blocked: count(summary.blocked_issues),
    closed: count(summary.closed_issues),
    epicsReady: parseEpicCount(epicStatusJson),
    tasks,
    current,
  }
}

export async function readSnapshot(directory: string, signal?: AbortSignal, run: BrRunner = runBr): Promise<Snapshot> {
  try {
    const [stats, list, epics] = await Promise.all([
      run(directory, ["stats", "--json", "--no-activity"], signal),
      run(directory, ["list", "--status", "in_progress", "--json"], signal),
      run(directory, ["epic", "status", "--eligible-only", "--json"], signal).catch(() => null),
    ])
    return parseSnapshot(stats, list, epics ?? undefined)
  } catch {
    return hiddenSnapshot()
  }
}
