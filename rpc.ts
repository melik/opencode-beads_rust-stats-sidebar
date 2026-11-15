import { Rpc } from "@opencode/plugin/rpc"

export const BeadsCurrent = Rpc.define({
  id: "beads_rust-sidebar",
  methods: {
    get: {
      input: {
        type: "object",
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          available: { type: "boolean" },
          total: { type: "integer", minimum: 0 },
          open: { type: "integer", minimum: 0 },
          inProgress: { type: "integer", minimum: 0 },
          blocked: { type: "integer", minimum: 0 },
          closed: { type: "integer", minimum: 0 },
          epicsReady: { type: "integer", minimum: 0 },
          plan: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["epic", "task"] },
              epicId: { type: "string" },
              epicTitle: { type: "string" },
              done: { type: "integer", minimum: 0 },
              total: { type: "integer", minimum: 0 },
              percent: { type: "integer", minimum: 0, maximum: 100 },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    status: { type: "string", enum: ["closed", "in_progress", "ready", "blocked", "deferred"] },
                  },
                  required: ["id", "title", "status"],
                  additionalProperties: false,
                },
              },
            },
            required: ["kind", "tasks"],
            additionalProperties: false,
          },
        },
        required: ["available", "total", "open", "inProgress", "blocked", "closed", "epicsReady"],
        additionalProperties: false,
      },
      errors: {},
    },
  },
  events: {},
})
