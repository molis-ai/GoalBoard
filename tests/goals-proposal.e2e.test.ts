import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID } from "@adeptify/goalboard-app-local-host";
import { GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("Proposal UI preserves user input on failed confirmation, retries atomically, and rejects without creating Goals", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, sessionId, command, evaluate, waitFor, click, reloadPage } = browser;
  const coordinator = new GoalProjectApplication(store);
  function propose(id: string) {
    const dialogue = coordinator.draftDialogue.startDraftDialogue({
      board_id: DEMO_BOARD_ID, actor_id: "browser-planner", goal_id: id + "-root",
      rough_idea: "用户决定以后才创建子目标 " + id, idempotency_key: id + "-start",
    });
    return coordinator.goalTreeSubmission.submitGoalTreeProposal({
      board_id: DEMO_BOARD_ID, actor_id: "browser-planner", discovered_in_run_id: dialogue.run!.run_id,
      root_goal_id: id + "-root", summary: "保留用户明确选择的子目标", idempotency_key: id + "-proposal",
      items: [{
        item_id: id + "-child", kind: "goal", operation: "create",
        payload: { goal_id: id + "-child", title: '待确认的子目标 <安全> "' + id },
        source_refs: ["conversation://browser-proposal"], reason: "先让用户决定", confidence: 1,
        affected_objects: [{ object_type: "goal", object_id: id + "-child" }],
      }, {
        item_id: id + "-relation", kind: "relation", operation: "create",
        payload: { from_goal_id: id + "-child", to_goal_id: id + "-root", type: "part_of", reason: "同一结果的子工作" },
        source_refs: ["conversation://browser-proposal"], reason: "确认后再建立归属", confidence: 1,
        affected_objects: [{ object_type: "goal", object_id: id + "-root" }],
      }],
    }).proposal;
  }
  const adopted = propose("browser-adopt"), rejected = propose("browser-reject");
  const before = store.snapshot(DEMO_BOARD_ID);
  const form = (id: string) => '[data-goal-tree-proposal-id="' + id + '"]';
  const dom = (selector: string) => "document.querySelector(" + JSON.stringify(selector) + ")";
  const adoptForm = form(adopted.proposal_id), rejectForm = form(rejected.proposal_id);
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.navigate", { url: origin + "/decisions" }, sessionId);
  await command("Page.bringToFront", {}, sessionId);
  await waitFor("document.readyState === 'complete' && " + dom(adoptForm));
  await click('[data-feed-entry-id="decision:browser-adopt-root"]');
  await click(adoptForm + ' button[value="confirm"]');
  await waitFor("document.activeElement === " + dom(adoptForm + ' textarea[name="reason"]'));
  assert.equal(await evaluate(dom(adoptForm + ' textarea[name="reason"]') + ".getAttribute('aria-invalid')"), "true");
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  await command("Input.insertText", { text: "确认这两个变化，断网后也保留这段意见。" }, sessionId);
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goal-tree-proposals/" + adopted.proposal_id + "/decision"] }, sessionId);
  await click(adoptForm + ' button[value="confirm"]');
  await waitFor("!" + dom(adoptForm + " [data-decision-error]") + ".hidden && !" + dom(adoptForm + ' button[value="confirm"]') + ".disabled");
  assert.equal(await evaluate(dom(adoptForm + ' textarea[name="reason"]') + ".value"), "确认这两个变化，断网后也保留这段意见。");
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).relations, before.relations);
  assert.equal(store.snapshot(DEMO_BOARD_ID).goal_tree_proposals.find(p => p.proposal_id === adopted.proposal_id)!.state, "pending");
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click(adoptForm + ' button[value="confirm"]');
  await waitFor("!" + dom(adoptForm) + " && " + dom("[data-decision-receipt]"));
  const afterAdopt = store.snapshot(DEMO_BOARD_ID);
  assert.equal(afterAdopt.goals.filter(g => g.goal_id === "browser-adopt-child").length, 1);
  assert.equal(afterAdopt.goals.find(g => g.goal_id === "browser-adopt-child")!.definition_state, "draft");
  assert.equal(afterAdopt.relations.filter(r => r.from_goal_id === "browser-adopt-child" && r.to_goal_id === "browser-adopt-root" && r.state === "active").length, 1);
  assert.equal(afterAdopt.goal_tree_proposals.find(p => p.proposal_id === adopted.proposal_id)!.state, "approved");
  assert.ok(afterAdopt.goal_tree_proposals.find(p => p.proposal_id === adopted.proposal_id)!.items.every(item => item.state === "applied"));
  assert.equal(await evaluate("document.activeElement.matches('[data-decision-receipt]')"), true);
  await reloadPage();
  await waitFor(dom(rejectForm));
  assert.equal(await evaluate("Boolean(" + dom(adoptForm) + ")"), false);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, afterAdopt.goals);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).relations, afterAdopt.relations);
  await click('[data-feed-entry-id="decision:browser-reject-root"]');
  await click(rejectForm + ' button[value="reject"]');
  await waitFor("document.activeElement === " + dom(rejectForm + ' textarea[name="reason"]'));
  await command("Input.insertText", { text: "暂不需要这个分支，保留原目标树。" }, sessionId);
  await click(rejectForm + ' button[value="reject"]');
  await waitFor("!" + dom(rejectForm) + " && " + dom("[data-decision-receipt]"));
  const afterReject = store.snapshot(DEMO_BOARD_ID);
  assert.equal(afterReject.goal_tree_proposals.find(p => p.proposal_id === rejected.proposal_id)!.state, "rejected");
  assert.deepEqual(afterReject.goals, afterAdopt.goals);
  assert.deepEqual(afterReject.relations, afterAdopt.relations);
  await reloadPage();
  assert.equal(await evaluate("Boolean(" + dom(rejectForm) + ")"), false);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, afterReject.goals);
});

test("Historical risk repair preserves its plan on network failure and creates a pending revision before explicit adoption", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, sessionId, command, evaluate, waitFor, click, reloadPage } = browser;
  const coordinator = new GoalProjectApplication(store);
  const dialogue = coordinator.draftDialogue.startDraftDialogue({
    board_id: DEMO_BOARD_ID, actor_id: "repair-planner", goal_id: "browser-repair-root",
    rough_idea: "升级前由用户选择风险处理方式", idempotency_key: "repair-start",
  });
  const submitted = coordinator.goalTreeSubmission.submitGoalTreeProposal({
    board_id: DEMO_BOARD_ID, actor_id: "repair-planner", discovered_in_run_id: dialogue.run!.run_id,
    root_goal_id: "browser-repair-root", summary: "新增升级验证工作并明确兼容风险", idempotency_key: "repair-proposal",
    items: [{
      item_id: "browser-repair-child", kind: "goal", operation: "create",
      payload: { goal_id: "browser-repair-child", title: "升级前验证历史数据" },
      source_refs: ["conversation://browser-repair"], reason: "决定前不创建", confidence: 1,
      affected_objects: [{ object_type: "goal", object_id: "browser-repair-child" }],
    }, {
      item_id: "browser-repair-risk-item", kind: "risk", operation: "create",
      payload: { risk_id: "browser-repair-risk", goal_ids: ["browser-repair-root"], description: "旧数据可能无法读取",
        probability: "medium", impact: "high", trigger: "升级后读取旧数据失败", treatment: "mitigate",
        blocking_mode: "none", revisit_condition: "升级验证结束", owner: "repair-planner" },
      source_refs: ["conversation://browser-repair"], reason: "由用户决定如何处理", confidence: 1,
      affected_objects: [{ object_type: "risk", object_id: "browser-repair-risk" }],
    }],
  }).proposal;
  // Reproduce the historical payload accepted by older versions. Current submission validation stays intact.
  const riskItem = submitted.items.find(item => item.item_id === "browser-repair-risk-item")!;
  store.db.prepare("UPDATE goal_tree_proposal_items SET payload_json = ? WHERE item_id = ?").run(
    JSON.stringify({ ...riskItem.payload, treatment: "升级前验证两个历史版本，保留原措施。" }), riskItem.item_id,
  );
  const before = store.snapshot(DEMO_BOARD_ID);
  const oldForm = '[data-goal-tree-proposal-id="' + submitted.proposal_id + '"]';
  const dom = (selector: string) => "document.querySelector(" + JSON.stringify(selector) + ")";
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.navigate", { url: origin + "/decisions" }, sessionId);
  await command("Page.bringToFront", {}, sessionId);
  await waitFor("document.readyState === 'complete' && " + dom(oldForm));
  await click('[data-feed-entry-id="decision:browser-repair-root"]');
  assert.equal(await evaluate(dom(oldForm + ' button[value="confirm"]') + ".disabled"), true);
  assert.equal(await evaluate(dom(oldForm + " [data-risk-treatment-plan]") + ".value"), "升级前验证两个历史版本，保留原措施。");
  await click(oldForm + ' button[value="repair-risks"]');
  await waitFor("document.activeElement.matches('[data-risk-proposal-repair] input[type=radio]')");
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).risks, before.risks);
  await click(oldForm + ' input[value="mitigate"]');
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goal-tree-proposals/" + submitted.proposal_id + "/decision"] }, sessionId);
  await click(oldForm + ' button[value="repair-risks"]');
  await waitFor("!" + dom(oldForm + " [data-decision-error]") + ".hidden && !" + dom(oldForm + ' button[value="repair-risks"]') + ".disabled");
  assert.equal(await evaluate(dom(oldForm + ' input[value="mitigate"]') + ".checked"), true);
  assert.equal(await evaluate(dom(oldForm + ' button[value="confirm"]') + ".disabled"), true);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goal_tree_proposals, before.goal_tree_proposals);
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click(oldForm + ' button[value="repair-risks"]');
  await waitFor("!" + dom(oldForm) + " && " + dom("[data-decision-receipt]"));
  const revisedSnapshot = store.snapshot(DEMO_BOARD_ID);
  const revision = revisedSnapshot.goal_tree_proposals.find(p => p.root_goal_id === "browser-repair-root" && p.version === submitted.version + 1)!;
  assert.ok(revision);
  assert.equal(revision.state, "pending");
  assert.equal(revision.items.find(item => item.kind === "risk")!.payload.treatment, "mitigate");
  assert.equal(revision.items.find(item => item.kind === "risk")!.payload.treatment_plan, "升级前验证两个历史版本，保留原措施。");
  assert.deepEqual(revisedSnapshot.goals, before.goals);
  assert.deepEqual(revisedSnapshot.risks, before.risks);
  const newForm = '[data-goal-tree-proposal-id="' + revision.proposal_id + '"]';
  await click(newForm + ' textarea[name="reason"]');
  await command("Input.insertText", { text: "确认修订后的目标和风险处理措施。" }, sessionId);
  await click(newForm + ' button[value="confirm"]');
  await waitFor("!" + dom(newForm));
  const adopted = store.snapshot(DEMO_BOARD_ID);
  assert.equal(adopted.goals.filter(goal => goal.goal_id === "browser-repair-child").length, 1);
  const risk = adopted.risks.find(risk => risk.risk_id === "browser-repair-risk")!;
  assert.equal(risk.treatment, "mitigate");
  assert.equal(risk.treatment_plan, "升级前验证两个历史版本，保留原措施。");
  await reloadPage();
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).risks, adopted.risks);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, adopted.goals);
});

test("Historical Candidate approval leaves a separate Rewire decision and rejecting it preserves the created Goal", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, before, sessionId, command, evaluate, waitFor, click, reloadPage } = browser;
  const candidate = before.candidates.find(candidate => candidate.state === "pending")!;
  assert.ok(candidate);
  const ownerId = before.runs.find(run => run.run_id === candidate.discovered_in_run_id)!.goal_id;
  const candidateForm = '[data-candidate-id="' + candidate.candidate_id + '"]';
  const dom = (selector: string) => "document.querySelector(" + JSON.stringify(selector) + ")";
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.navigate", { url: origin + "/decisions" }, sessionId);
  await command("Page.bringToFront", {}, sessionId);
  await waitFor("document.readyState === 'complete' && " + dom(candidateForm));
  await click('[data-feed-entry-id="decision:' + ownerId + '"]');
  await click(candidateForm + ' button[value="approved"]');
  await waitFor("document.activeElement === " + dom(candidateForm + ' textarea[name="reason"]'));
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, before.goals);
  await command("Input.insertText", { text: "这项升级说明需要单独交付，同意加入。" }, sessionId);
  await click(candidateForm + ' button[value="approved"]');
  await waitFor("!" + dom(candidateForm));
  const approved = store.snapshot(DEMO_BOARD_ID);
  const storedCandidate = approved.candidates.find(item => item.candidate_id === candidate.candidate_id)!;
  assert.equal(storedCandidate.state, "approved");
  const goalId = String(storedCandidate.decision!.formal_goal_id);
  assert.equal(approved.goals.filter(goal => goal.goal_id === goalId).length, 1);
  assert.equal(approved.goals.find(goal => goal.goal_id === goalId)!.validity_state, "needs_revalidation");
  assert.deepEqual(approved.relations, before.relations);
  const rewire = approved.rewires.find(item => item.candidate_id === candidate.candidate_id)!;
  assert.equal(rewire.state, "pending");
  const rewireForm = '[data-rewire-id="' + rewire.rewire_id + '"]';
  await waitFor(dom(rewireForm));
  await click(rewireForm + ' textarea[name="reason"]');
  await command("Input.insertText", { text: "保留独立 Goal，不需要关系调整。" }, sessionId);
  await click(rewireForm + ' button[value="rejected"]');
  await waitFor("!" + dom(rewireForm));
  const rejected = store.snapshot(DEMO_BOARD_ID);
  assert.equal(rejected.rewires.find(item => item.rewire_id === rewire.rewire_id)!.state, "rejected");
  assert.deepEqual(rejected.relations, before.relations);
  assert.equal(rejected.goals.find(goal => goal.goal_id === goalId)!.validity_state, "valid");
  assert.equal(rejected.goals.length, before.goals.length + 1);
  await reloadPage();
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).goals, rejected.goals);
  assert.deepEqual(store.snapshot(DEMO_BOARD_ID).rewires, rejected.rewires);
});
