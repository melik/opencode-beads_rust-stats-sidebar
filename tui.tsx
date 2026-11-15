/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal, For, Show } from "solid-js"
import { hiddenSnapshot, type Snapshot } from "./beads.js"
import { epicSummaryLine, statisticLine, taskLine } from "./display.js"
import { createI18n } from "./i18n.js"
import { BeadsCurrent } from "./rpc.js"

export default Plugin.define({
  id: "beads_rust-sidebar-tui",
  setup(ctx) {
    const i18n = createI18n()
    const labelWidth = Math.max(...i18n.statuses.map((label) => label.length))
    const location = ctx.location ?? ctx.data.location.default()
    const [snapshot, setSnapshot] = createSignal<Snapshot>(hiddenSnapshot())
    let disposed = false
    let sequence = 0

    async function refresh() {
      const request = ++sequence
      try {
        const next = await ctx.client.rpc(BeadsCurrent).get({}, { location }) as Snapshot
        if (!disposed && request === sequence) setSnapshot(next)
      } catch {
        if (!disposed && request === sequence) setSnapshot(hiddenSnapshot())
      }
    }

    const remove = ctx.ui.slot({
      append: "sidebar.content",
      render: () => (
        <Show when={snapshot().available}>
          <box flexDirection="column" paddingTop={1}>
            <text fg={ctx.theme.text.base}><b>Beads</b></text>
            <text fg={ctx.theme.text.muted}>{i18n.total(snapshot().total)}</text>
            {i18n.statuses.map((label, index) => (
              <text fg={ctx.theme.text.muted}>
                {statisticLine(label, [snapshot().open, snapshot().inProgress, snapshot().blocked, snapshot().closed][index], snapshot().total, labelWidth)}
              </text>
            ))}
            <Show when={snapshot().epicsReady > 0}>
              <text fg={ctx.theme.text.muted}>{i18n.epicsReady(snapshot().epicsReady)}</text>
            </Show>
            <Show when={snapshot().plan}>
              {(plan) => (
                <box flexDirection="column" paddingTop={1}>
                  <Show when={plan().kind === "epic"}>
                    <text fg={ctx.theme.text.muted}>{epicSummaryLine(plan().epicId ?? "", plan().done ?? 0, plan().total ?? 0)}</text>
                  </Show>
                  <For each={plan().tasks}>
                    {(task) => (
                      <text fg={ctx.theme.text.muted}>
                        {taskLine(task.status, task.title)}
                      </text>
                    )}
                  </For>
                </box>
              )}
            </Show>
          </box>
        </Show>
      ),
    })

    let timer: ReturnType<typeof setTimeout> | undefined
    async function poll() {
      await refresh()
      if (!disposed) timer = setTimeout(() => void poll(), 5000)
    }
    void poll()
    return () => {
      disposed = true
      sequence++
      if (timer) clearTimeout(timer)
      remove()
    }
  },
})
