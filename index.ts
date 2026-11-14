import { Plugin } from "@opencode/plugin"
import { readSnapshot } from "./beads.js"
import { BeadsCurrent } from "./rpc.js"

export default Plugin.define({
  id: "beads_rust-sidebar",
  async setup(ctx) {
    const registration = await ctx.rpc.register(BeadsCurrent, {
      get: async (_input, context) => readSnapshot(ctx.location.directory, context.signal),
    })
    return () => registration.dispose()
  },
})
