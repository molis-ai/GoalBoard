import assert from "node:assert/strict";
import test from "node:test";
import { openGoalBrowser } from "./fixtures/goal-browser.js";
import type { GoalBoardWebView } from "./workbench-renderer-fixture.js";

test("project rules preserve validation, failed-save inputs, one persisted update, inheritance and one-time receipt", { timeout: 60_000 }, async t => {
  const browser = await openGoalBrowser(t, true);
  if (!browser) return;
  const { origin, projectId, command, sessionId, evaluate, waitFor, click, navigate, reloadPage } = browser;
  assert.ok(projectId);
  const prefix = "/projects/" + projectId;
  const read = async () => await (await fetch(origin + prefix + "/api/board")).json() as GoalBoardWebView;
  const before = await read();
  await command("Network.enable", {}, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + prefix + "/settings/rules" }, sessionId));
  await waitFor("document.readyState === 'complete' && document.querySelector('[data-policy-form]')");
  const submit = '[data-policy-form] button[type="submit"]';
  await evaluate("document.querySelector('[name=reason]').value = ''");
  await click(submit);
  await waitFor("document.activeElement.name === 'reason'");
  assert.deepEqual(await read(), before);

  const reason = "Browser-verified project baseline";
  await evaluate(`(() => {
    const form = document.querySelector('[data-policy-form]');
    form.elements.reason.value = ${JSON.stringify(reason)};
    form.elements.cross_reviewers.value = '1';
    form.elements.adversarial_reviewers.value = '1';
    form.elements.max_lease_seconds.value = '900';
    form.elements.required_capabilities.value = 'browser,browser，reviewer';
    form.elements.self_verification.checked = true;
    form.elements.human_approval.checked = true;
    form.querySelector('[name=goal_mode][value=preferred]').checked = true;
    form.elements.reason.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await command("Network.setBlockedURLs", { urls: [origin + prefix + "/api/policy-bindings"] }, sessionId);
  await click(submit);
  await waitFor("document.querySelector('[data-policy-error]').hidden === false && !document.querySelector('[data-policy-form] button[type=submit]').disabled");
  assert.equal(await evaluate("document.querySelector('[name=reason]').value"), reason);
  assert.equal(await evaluate("document.querySelector('[name=cross_reviewers]').value"), "1");
  assert.deepEqual(await read(), before, "A failed request cannot change policy or Goal facts");

  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await navigate(() => click(submit));
  await waitFor("document.readyState === 'complete' && document.querySelector('[data-project-rules-receipt]').hidden === false");
  assert.match(await evaluate<string>("document.querySelector('[data-project-rules-receipt]').textContent"), /项目工作规则已保存/);
  assert.equal(await evaluate("document.activeElement.hasAttribute('data-project-rules-receipt')"), true);
  const after = await read();
  const updates = after.policy_bindings.filter(x => x.reason === reason);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]!.state, "active");
  assert.equal(updates[0]!.scope, "project_default");
  assert.equal(updates[0]!.goal_id, null);
  assert.deepEqual(updates[0]!.policy, {
    goal_mode: "preferred", self_verification: true, human_approval: true,
    cross_reviewers: 1, adversarial_reviewers: 1, max_lease_seconds: 900,
    required_capabilities: ["browser", "reviewer"],
  });
  for (const goal of after.goals) {
    assert.equal(goal.resolved_policy.self_verification, true);
    assert.equal(goal.resolved_policy.human_approval, true);
    assert.ok(goal.resolved_policy.cross_reviewers >= 1);
    assert.ok(goal.resolved_policy.adversarial_reviewers >= 1);
    assert.ok(goal.resolved_policy.max_lease_seconds <= 900);
    assert.ok(goal.resolved_policy.required_capabilities.includes("browser"));
    assert.ok(goal.resolved_policy.required_capabilities.includes("reviewer"));
  }
  assert.deepEqual(after.snapshot.claims, before.snapshot.claims);
  assert.deepEqual(after.snapshot.runs, before.snapshot.runs);
  const content = (view: GoalBoardWebView) => view.goals.map(({ goal }) =>
    [goal.goal_id, goal.title, goal.outcome, goal.why, goal.business_logic]);
  assert.deepEqual(content(after), content(before));
  assert.equal(await evaluate("document.querySelector('[name=max_lease_seconds]').value"), "900");
  assert.equal(await evaluate("sessionStorage.getItem('goalboard-project-rules-receipt:' + document.body.dataset.routePrefix)"), null);
  await reloadPage();
  assert.equal(await evaluate("document.querySelector('[data-project-rules-receipt]').hidden"), true);
  assert.deepEqual(await read(), after, "Refreshing consumes no new policy write or work");
});
