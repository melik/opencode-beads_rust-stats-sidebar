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
          tasks: { type: "array", items: { $ref: "#/$defs/task" } },
          current: { anyOf: [{ type: "null" }, { $ref: "#/$defs/task" }] },
        },
        required: ["available", "total", "open", "inProgress", "blocked", "closed", "epicsReady", "tasks", "current"],
        additionalProperties: false,
        $defs: {
          task: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { anyOf: [{ type: "string" }, { type: "null" }] },
            },
            required: ["id", "title", "description"],
            additionalProperties: false,
          },
        },
      },
      errors: {},
    },
  },
  events: {},
})
