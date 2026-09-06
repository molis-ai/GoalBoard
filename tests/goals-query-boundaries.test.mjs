import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkGoalReadOwnerSql } from "../scripts/check-package-boundaries.mjs";

test("Goal read guard covers actual root callers and rejects restored Policy, Risk and relation SQL", () => {
  for (const file of ["src/web/server.ts", "src/v1/coordinator.ts", "src/mcp/server.ts", "src/v1/cli.ts", "src/feed/store.ts"]) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.deepEqual(checkGoalReadOwnerSql(source), [], file);
    for (const sql of ["SELECT 1 FROM goals WHERE board_id = ? AND goal_id = ?", "SELECT * FROM policy_bindings", "SELECT risk_id, goal_id FROM goal_risks",
      "SELECT title FROM goal_relations r JOIN goals g ON g.goal_id = r.to_goal_id", "SELECT * FROM risks"]) {
      assert.match(checkGoalReadOwnerSql(`${source}\nstore.db.prepare(${JSON.stringify(sql)});`).join("\n"), /public Goals Query/);
    }
  }
});
