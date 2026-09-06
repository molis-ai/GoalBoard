import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkDraftDialogueOwnership, checkDraftProposalOwnerSql, checkGoalTreeApplicationOwnership, checkProposalUiOwnership } from "../scripts/check-package-boundaries.mjs";

test("DD2 UI guard rejects restored root implementations, bypassed mounts and legacy client handlers", () => {
  const sources = ["src/web/render.ts", "apps/workbench/src/index.ts", "apps/workbench/src/goals-proposal-ui.ts", "apps/workbench/src/goals-legacy-proposal-ui.ts", "apps/workbench/src/scripts/client/events-accessibility.ts"]
    .map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  assert.deepEqual(checkProposalUiOwnership(...sources), []);
  for (const name of ["renderGoalTreeProposalDecision", "renderContractProposal", "recentDecisionResults"]) {
    const changed = [...sources]; changed[0] += `\nfunction ${name}(view) { return oldRenderer(view); }`;
    assert.match(checkProposalUiOwnership(...changed).join("\n"), /belongs to the Goals contribution/);
  }
  const unregistered = [...sources]; unregistered[1] = unregistered[1].replace("host.register(goalsProposalUiContribution)", "registerElsewhere()");
  assert.match(checkProposalUiOwnership(...unregistered).join("\n"), /registered with UiHost/);
  const bypassed = [...sources]; bypassed[2] = bypassed[2].replace("host.mount(", "oldRender(");
  assert.match(checkProposalUiOwnership(...bypassed).join("\n"), /must mount/);
  const legacy = [...sources]; legacy[4] += '\nconst goalTreeDecisionForm = form.closest("[data-goal-tree-decision-form]");';
  assert.match(checkProposalUiOwnership(...legacy).join("\n"), /Goals client factory/);
});

test("DD2 submission guard rejects the legacy caller, facade and application persistence", () => {
  const sources = ["src/v1/coordinator.ts", "src/local-host/composition.ts", "plugins/native/goals/src/goal-tree-submission.ts"]
    .map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  assert.deepEqual(checkGoalTreeApplicationOwnership(...sources), []);
  assert.match(checkGoalTreeApplicationOwnership(`${sources[0]}\n  submitGoalTreeProposal(input) { return legacy(input); }`, sources[1], sources[2]).join("\n"), /legacy/);
  assert.match(checkGoalTreeApplicationOwnership(sources[0], sources[1].replace("coordinator.goalTreeSubmission.submitGoalTreeProposal(", "coordinator.submitGoalTreeProposal("), sources[2]).join("\n"), /public goalTreeSubmission/);
  for (const extra of ["store.immediate(operation)", "coordinator.submitGoalTreeProposal(input)", "db.prepare('INSERT INTO goal_tree_proposals VALUES (?)')"]) {
    assert.match(checkGoalTreeApplicationOwnership(sources[0], sources[1], `${sources[2]}\n${extra}`).join("\n"), /Module owners/);
  }
});

test("Draft owner guard rejects restoring the removed cross-module proposal SQL", () => {
  const source = readFileSync(new URL("../modules/goals/src/goal-commands.ts", import.meta.url), "utf8");
  assert.deepEqual(checkDraftProposalOwnerSql(source), []);
  for (const sql of ["SELECT proposal_id FROM contract_proposals", "UPDATE contract_proposals SET state = 'superseded'"]) {
    assert.match(checkDraftProposalOwnerSql(`${source}\nrepository.db.prepare(${JSON.stringify(sql)});`).join("\n"), /Governance records/);
  }
});

test("DD2 preflight guard rejects a restored legacy check or SQL callback", () => {
  const sources = ["src/v1/coordinator.ts", "src/local-host/composition.ts", "plugins/native/goals/src/goal-tree-check.ts"]
    .map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const check = (...args) => checkGoalTreeApplicationOwnership(...args, "checkGoalTreeProposal", "goalTreeCheck");
  assert.deepEqual(check(...sources), []);
  assert.match(check(`${sources[0]}\n  checkGoalTreeProposal(input) { return legacy(input); }`, sources[1], sources[2]).join("\n"), /legacy/);
  assert.match(check(sources[0], sources[1].replace("coordinator.goalTreeCheck.checkGoalTreeProposal(", "coordinator.checkGoalTreeProposal("), sources[2]).join("\n"), /public goalTreeCheck/);
  assert.match(check(sources[0], sources[1], `${sources[2]}\nstore.immediate(check)`).join("\n"), /Module owners/);
});

for (const [method, port, file] of [
  ["decideGoalTreeProposal", "goalTreeDecision", "goal-tree-decision"],
  ["decideContractProposal", "legacyContractDecision", "legacy-contract-decision"],
  ["decideCandidate", "legacyCandidateDecision", "legacy-candidate-decision"],
  ["confirmRewire", "legacyRewireDecision", "legacy-rewire-decision"],
  ["submitContractProposal", "legacyProposalSubmission", "legacy-proposal-submission"],
  ["submitCandidate", "legacyProposalSubmission", "legacy-proposal-submission"],
  ["submitDependencyProposal", "legacyProposalSubmission", "legacy-proposal-submission"],
]) test(`DD2 ${method} cannot return to Coordinator or call its persistence`, () => {
  const sources = ["src/v1/coordinator.ts", "src/local-host/composition.ts", `plugins/native/goals/src/${file}.ts`]
    .map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const check = (...args) => checkGoalTreeApplicationOwnership(...args, method, port);
  assert.deepEqual(check(...sources), []);
  assert.match(check(`${sources[0]}\n  ${method}(input) { return legacy(input); }`, sources[1], sources[2]).join("\n"), /legacy/);
  assert.match(check(sources[0], sources[1].replace(`coordinator.${port}.${method}(`, `coordinator.${method}(`), sources[2]).join("\n"), new RegExp(`public ${port}`));
  assert.match(check(sources[0], sources[1], `${sources[2]}\nstore.immediate(decide)`).join("\n"), /Module owners/);
});

test("DD1 guard accepts the real owners and rejects restored legacy callers, facades and cross-owner SQL", () => {
  const sources = ["src/v1/coordinator.ts", "src/local-host/composition.ts",
    "plugins/native/goals/src/draft-dialogue-application.ts"]
    .map(file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  assert.deepEqual(checkDraftDialogueOwnership(...sources), []);
  for (const method of ["startDraftDialogue", "recordDraftDialogueTurn", "resumeDraftDialogue"]) {
    assert.match(checkDraftDialogueOwnership(`${sources[0]}\n  ${method}(input) { return legacy(input); }`, sources[1], sources[2]).join("\n"), /legacy/);
    assert.match(checkDraftDialogueOwnership(sources[0], `${sources[1]}\ncoordinator.${method}(input)`, sources[2]).join("\n"), /public draftDialogue/);
  }
  assert.match(checkDraftDialogueOwnership(sources[0], sources[1], `${sources[2]}\ndb.prepare('UPDATE clarification_sessions SET state = ?')`).join("\n"), /Module owners/);
});
