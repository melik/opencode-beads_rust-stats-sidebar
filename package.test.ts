import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { test } from "node:test"

test("npm package includes the TSX compiler configuration", () => {
  const result = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { encoding: "utf8" }))
  assert.ok(result[0].files.some((file: { path: string }) => file.path === "tsconfig.json"))
  assert.match(readFileSync(new URL("./tui.tsx", import.meta.url), "utf8"), /^\/\*\* @jsxImportSource @opentui\/solid \*\//)
})
