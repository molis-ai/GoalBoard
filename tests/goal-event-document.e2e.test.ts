import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID, GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

test("event document writes planning, report, concern, decision and closure through the production UI", { timeout: 120_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, sessionId, command, evaluate, click, navigate } = browser;
  const app = new GoalProjectApplication(store);
  const created = app.goalEvents.createIntent({
    board_id: DEMO_BOARD_ID,
    title: "隔离演示：内部试用写回",
    outcome: "经正式页面写入后再读回",
    actor_id: "web-user",
    actor_kind: "user",
    idempotency_key: "e2e-intent",
  });
  const goalId = created.goal.goal_id;
  async function waitDom(expression: string) {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (await evaluate(`Boolean(${expression})`)) return;
      await evaluate("new Promise((resolve) => setTimeout(resolve, 400))");
    }
    throw new Error("DOM condition timeout: " + expression + "; " + await evaluate(
      "JSON.stringify({toast:document.querySelector('[data-toast]')?.textContent,status:document.querySelector('[data-form-status]:not([hidden])')?.textContent,conflict:document.querySelector('[data-event-conflict]:not([hidden])')?.textContent,busy:document.querySelector('[data-document-pane]')?.getAttribute('aria-busy'),goal:document.querySelector('[data-goal-event-document]')?.dataset.goalView,cursor:document.querySelector('[data-goal-event-document]')?.dataset.goalEventCursor})",
    ));
  }
  const visibleDoc = "[data-goal-event-document]:not([hidden])";
  async function openPlanning() {
    await waitIdle();
    await click(`${visibleDoc} .header-actions > [data-event-reader="planning"]`);
    await waitDom(`document.querySelector('${visibleDoc} [data-event-reader-root]') && !document.querySelector('${visibleDoc} [data-event-reader-root]').hasAttribute('hidden')`);
  }
  async function openNamedForm(name: string) {
    await openPlanning();
    await waitDom(`document.querySelector('${visibleDoc} [data-event-panel="planning"] [data-event-form-open=${JSON.stringify(name)}]')?.getBoundingClientRect().width > 8`);
    await click(`${visibleDoc} [data-event-panel="planning"] [data-event-form-open=${JSON.stringify(name)}]`);
    await waitDom(`document.querySelector('${visibleDoc} [data-event-form=${JSON.stringify(name)}]') && document.querySelector('${visibleDoc} [data-event-form=${JSON.stringify(name)}]').hidden === false`);
  }
  async function waitIdle() {
    await waitDom("document.querySelector('[data-document-pane]')?.getAttribute('aria-busy') !== 'true'");
  }
  async function submitSuccess(selector: string) {
    const before = app.goalEvents.readState(DEMO_BOARD_ID, goalId).goal_event_cursor;
    await click(selector);
    await waitDom(
      `document.querySelector("[data-goal-event-document]")?.dataset.goalView === ${JSON.stringify(goalId)} && Number(document.querySelector("[data-goal-event-document]")?.dataset.goalEventCursor) > ${before} && document.querySelector("[data-document-pane]")?.getAttribute("aria-busy") !== "true"`,
    );
  }
  async function fillField(selector: string, value: string) {
    await evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      input.focus();
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
  }
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await command("Page.addScriptToEvaluateOnNewDocument", { source: `(()=>{const original=window.setInterval;window.setInterval=function(fn,ms,...args){if(ms===4000&&typeof fn==='function')window.__refreshCallback=fn;return original.call(this,fn,ms,...args);};})()` }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/" + encodeURIComponent(goalId) }, sessionId));
  await waitDom(`document.querySelector('[data-goal-event-document]')?.dataset.goalView === ${JSON.stringify(goalId)}`);
  const headerBeforeHistory = await evaluate("document.querySelector('[data-current-summary]')?.textContent");
  await click("[data-goal-event-document]:not([hidden]) .goal-header [data-event-reader='planning']");
  await waitDom("document.querySelector('[data-event-reader-root]') && !document.querySelector('[data-event-reader-root]').hasAttribute('hidden')");
  assert.match(await evaluate("document.querySelector('[data-event-panel=planning]')?.textContent || ''"), /未采用模板|空白起点/);
  await click("[data-goal-event-document]:not([hidden]) [data-event-panel='planning'] [data-event-reader='type']");
  await waitDom("document.querySelector('[data-event-form=type]') && document.querySelector('[data-event-form=type]').hidden === false");
  await evaluate(`(() => {
    const form = document.querySelector('[data-event-form="type"]');
    form.querySelector('[name="name"]').value = "进展记录";
    form.querySelector('[name="purpose"]').value = "记下实际做成的事";
    const fieldName = form.querySelector('[name="field_name"]');
    if (fieldName && !fieldName.value) fieldName.value = "内容";
    form.querySelector('[name="add_requirement"]').checked = true;
    const statement = form.querySelector('[name="requirement_statement"]');
    if (statement) {
      statement.closest("[data-new-requirement]")?.removeAttribute("hidden");
      statement.value = "能读回刚才写入的事实";
    }
    return true;
  })()`);
  await submitSuccess('[data-event-form="type"] button[type="submit"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.goalEvents.readState(DEMO_BOARD_ID, goalId).config.types.some((type) => type.name === "进展记录")) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  const typeId = app.goalEvents.readState(DEMO_BOARD_ID, goalId).config.types.find((type) => type.name === "进展记录")?.type_id;
  assert.ok(typeId);
  await waitDom(`document.querySelector('[data-event-report="${typeId}"]')`);
  await openNamedForm("adopt");
  const methodId = await evaluate(`document.querySelector('[data-event-form="adopt"] [name="method_id"] option[value]:not([value=""])')?.value || ""`) as string;
  assert.ok(methodId, "adopt form must list current effective planning methods");
  await submitSuccess('[data-event-form="adopt"] button[type="submit"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.goalEvents.readState(DEMO_BOARD_ID, goalId).config.adopted_planning.length) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  assert.ok(app.goalEvents.readState(DEMO_BOARD_ID, goalId).config.adopted_planning.length);
  await openNamedForm("agreement");
  await evaluate(`document.querySelector('[data-event-form="agreement"] [name="outcome"]').value='经页面修改后的约定'`);
  await submitSuccess('[data-event-form="agreement"] button[type="submit"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (/经页面修改后的约定/.test(app.goalEvents.readState(DEMO_BOARD_ID, goalId).agreement.outcome)) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  assert.match(app.goalEvents.readState(DEMO_BOARD_ID, goalId).agreement.outcome, /经页面修改后的约定/);
  await openPlanning();
  await click(`[data-goal-event-document]:not([hidden]) [data-event-form-open="type-edit"][data-type-id="${typeId}"]`);
  await waitDom(`document.querySelector('[data-event-form="type-edit"][data-type-id="${typeId}"]') && document.querySelector('[data-event-form="type-edit"][data-type-id="${typeId}"]').hidden === false`);
  await submitSuccess(`[data-event-form="type-edit"][data-type-id="${typeId}"] button[type="submit"]`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.goalEvents.readState(DEMO_BOARD_ID, goalId).config.types.find((type) => type.type_id === typeId)?.version === 2) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  assert.equal(app.goalEvents.readState(DEMO_BOARD_ID, goalId).config.types.find((type) => type.type_id === typeId)?.version, 2);
  await openPlanning();
  await click(`[data-goal-event-document]:not([hidden]) [data-event-report="${typeId}"]`);
  await waitDom(`document.querySelector('[data-event-form=report][data-type-id="${typeId}"]') && document.querySelector('[data-event-form=report][data-type-id="${typeId}"]').hidden === false`);
  await evaluate(`(() => {
    const form = document.querySelector('[data-event-form="report"][data-type-id=${JSON.stringify(typeId)}]');
    form.querySelector('[data-event-title]').value = "时间线已经接到真实写入";
    const body = form.querySelector("[data-report-field]");
    if (body) body.value = "这条是隔离演示库里的真实报告。";
    return true;
  })()`);
  await submitSuccess(`[data-event-form="report"][data-type-id="${typeId}"] button[type="submit"]`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.goalEvents.readState(DEMO_BOARD_ID, goalId).latest_reports[0]?.title === "时间线已经接到真实写入") break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  assert.equal(app.goalEvents.readState(DEMO_BOARD_ID, goalId).latest_reports[0]?.title, "时间线已经接到真实写入");
  await openNamedForm("concern");
  await evaluate(`(() => {
    const form = document.querySelector('[data-event-form="concern"]');
    form.querySelector('[name="title"]').value = "还要核对范围";
    form.querySelector('[name="statement"]').value = "Concern 必须指出影响的要求";
    const requirement = form.querySelector('[name="requirement_ids"]');
    if (requirement) requirement.checked = true;
    return true;
  })()`);
  await submitSuccess('[data-event-form="concern"] button[type="submit"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.goalEvents.readState(DEMO_BOARD_ID, goalId).concerns.length >= 1) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  assert.ok(app.goalEvents.readState(DEMO_BOARD_ID, goalId).concerns.length >= 1);
  await openNamedForm("decision");
  await evaluate(`(() => {
    const form = document.querySelector('[data-event-form="decision"]');
    const conclusion = form.querySelector('[name="conclusion"]');
    if (conclusion) conclusion.value = "接受当前范围";
    form.querySelectorAll('[name="effect"]').forEach((input) => {
      input.checked = input.value === "accept_requirements" || input.value === "accept_concerns";
    });
    form.querySelectorAll('[name="requirement_ids"]').forEach((input) => { input.checked = true; });
    form.querySelectorAll('[name="concern_ids"]').forEach((input) => { input.checked = true; });
    return true;
  })()`);
  await submitSuccess('[data-event-form="decision"] button[type="submit"]');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (app.goalEvents.readState(DEMO_BOARD_ID, goalId).current_decisions.length >= 1) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 250))");
  }
  assert.ok(app.goalEvents.readState(DEMO_BOARD_ID, goalId).current_decisions.length >= 1);
  const headerAfterWrites = await evaluate("document.querySelector('[data-current-summary]')?.textContent");
  await waitDom(`document.querySelectorAll('${visibleDoc} [data-timeline-item]').length > 1`);
  const older = await evaluate(`document.querySelectorAll('${visibleDoc} [data-timeline-item]').length`) as number;
  assert.ok(older > 1);
  const olderId = await evaluate(`document.querySelectorAll('${visibleDoc} [data-timeline-item]')[1].dataset.timelineItem`) as string;
  await click(`${visibleDoc} [data-timeline-item="${olderId}"]`);
  await waitDom("document.querySelector('[data-event-sheet] .event, [data-event-sheet] .no-results')");
  assert.equal(await evaluate("document.querySelector('[data-current-summary]')?.textContent"), headerAfterWrites);
  assert.notEqual(headerAfterWrites, headerBeforeHistory);
  await openNamedForm("closure");
  const versions = await evaluate<{ config: string; agreement: string }>(`({
    config: document.querySelector('[data-event-form="closure"] [name="expected_config_version"]').value,
    agreement: document.querySelector('[data-event-form="closure"] [name="expected_agreement_version"]').value,
  })`);
  await fillField('[data-event-form="closure"] [name="reason"]', "旧版本收尾");
  app.goalEvents.configure({
    board_id: DEMO_BOARD_ID,
    goal_id: goalId,
    actor_id: "web-user",
    actor_kind: "user",
    expected_version: Number(versions.config),
    new_requirements: [{ requirement_id: "extra-need", statement: "冲突探测用" }],
    idempotency_key: "e2e-conflict-bump",
  });
  await click('[data-event-form="closure"] button[type="submit"]');
  await waitDom("document.querySelector('[data-conflict-retry]')");
  assert.equal(await evaluate("document.querySelector('[data-event-form=closure] [name=reason]').value"), "旧版本收尾");
  assert.equal(await evaluate("document.querySelector('[data-event-form=closure] [name=expected_config_version]').value"), versions.config);
  assert.match(await evaluate("document.querySelector('[data-event-conflict]').textContent || ''"), /当前预期结果|约定版本|配置版本/);
  const retryKey = await evaluate("document.querySelector('[data-event-form=closure]').dataset.idempotencyKey || ''");
  assert.ok(retryKey);
  const beforeReviewCursor = app.goalEvents.readState(DEMO_BOARD_ID, goalId).goal_event_cursor;
  await evaluate(`(() => {
    if (typeof window.__refreshCallback !== "function") throw new Error("Missing real refresh callback");
    const real = window.fetch.bind(window);
    let once = true;
    window.fetch = async (input, init) => {
      const response = await real(input, init);
      if (once && String(input).endsWith("/event-state")) {
        once = false;
        await window.__refreshCallback();
      }
      return response;
    };
  })()`);
  await click("[data-conflict-retry]");
  await waitDom(`document.querySelector('[data-event-form=closure] [name=expected_config_version]')?.value !== ${JSON.stringify(versions.config)}`);
  assert.equal(await evaluate("document.querySelector('[data-event-form=closure] [name=reason]').value"), "旧版本收尾");
  assert.equal(await evaluate("document.querySelector('[data-event-form=closure]').dataset.idempotencyKey || ''"), "");
  assert.equal(app.goalEvents.readState(DEMO_BOARD_ID, goalId).goal_event_cursor, beforeReviewCursor);
  const state = app.goalEvents.readState(DEMO_BOARD_ID, goalId);
  assert.equal(state.latest_reports[0]?.title, "时间线已经接到真实写入");
  assert.equal(state.owner?.kind, "event_work");
  assert.ok(state.concerns.length >= 1);
  assert.ok(state.current_decisions.length >= 1);
});

test("legacy unfinished Goal can continue explicitly and reading history does not write owner", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, origin, sessionId, command, evaluate, click, navigate, waitFor } = browser;
  const app = new GoalProjectApplication(store);
  const goalId = "V1";
  async function submitSuccess(selector: string) {
    const before = app.goalEvents.readState(DEMO_BOARD_ID, goalId).goal_event_cursor;
    await click(selector);
    await waitFor(
      `document.querySelector("[data-goal-event-document]")?.dataset.goalView === ${JSON.stringify(goalId)} && Number(document.querySelector("[data-goal-event-document]")?.dataset.goalEventCursor) > ${before} && document.querySelector("[data-document-pane]")?.getAttribute("aria-busy") !== "true"`,
    );
  }
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/V1" }, sessionId));
  await evaluate(`new Promise((resolve) => {
    const deadline = Date.now() + 4000;
    const check = () => {
      if (document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'V1') resolve(true);
      else if (Date.now() >= deadline) resolve(false);
      else requestAnimationFrame(check);
    };
    check();
  })`);
  await waitFor(`document.querySelector('[data-event-form="continue"]') && document.querySelector('[data-event-form="continue"]').hidden === false`);
  await click("[data-goal-event-document]:not([hidden]) .header-actions > [data-event-reader='planning']");
  await waitFor("document.querySelector('[data-event-reader-root]') && !document.querySelector('[data-event-reader-root]').hasAttribute('hidden')");
  assert.equal(await evaluate(`document.querySelector('[data-event-form="continue"]')?.hidden === true`), true);
  await click("[data-goal-event-document]:not([hidden]) [data-event-back]");
  await waitFor(`document.querySelector('[data-event-reader-root]')?.hasAttribute('hidden') === true && document.querySelector('[data-event-form="continue"]')?.hidden === false`);
  await click("[data-goal-event-document]:not([hidden]) [data-event-form-open='note']");
  await waitFor(`document.querySelector('[data-event-form="note"]')?.hidden === false`);
  assert.equal(await evaluate(`document.querySelector('[data-event-form="continue"]')?.hidden === true`), true);
  await click('[data-event-form="note"] [data-event-back]');
  await waitFor(`document.querySelector('[data-event-form="note"]')?.hidden === true && document.querySelector('[data-event-form="continue"]')?.hidden === false`);
  assert.equal(app.goalEvents.isEventStateOwner(DEMO_BOARD_ID, "V1"), false);
  const snapshot = store.snapshot(DEMO_BOARD_ID);
  assert.ok(
    snapshot.runs.some((item) => item.goal_id === "V1")
      || snapshot.evidence.some((item) => item.goal_id === "V1")
      || snapshot.reviews.some((item) => item.goal_id === "V1")
      || snapshot.goals.some((item) => item.goal_id === "V1"),
  );
  const historyId = await evaluate(`(
    document.querySelector('[data-source="legacy_evidence"],[data-source="legacy_run"],[data-source="legacy_review"],[data-source="legacy_record"]')
    || document.querySelector('[data-timeline-item]')
  )?.dataset.timelineItem || ""`) as string;
  assert.ok(historyId, "V1 mixed timeline must include original records");
  await click(`[data-timeline-item="${historyId}"]`);
  await evaluate(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 4000;
    const check = () => {
      if (document.querySelector('[data-event-sheet] .event')) resolve(true);
      else if (Date.now() >= deadline) reject(new Error('evidence body timeout'));
      else requestAnimationFrame(check);
    };
    check();
  })`);
  const body = await evaluate("document.querySelector('[data-event-sheet]')?.textContent || ''");
  assert.match(body, /原记录|原 Run|原 Evidence|原 Review|关系|未填写/);
  assert.equal(app.goalEvents.isEventStateOwner(DEMO_BOARD_ID, "V1"), false);
  await submitSuccess('[data-event-form="continue"] button[type=submit]');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (app.goalEvents.isEventStateOwner(DEMO_BOARD_ID, "V1")) break;
    await evaluate("new Promise((resolve) => setTimeout(resolve, 400))");
  }
  assert.equal(app.goalEvents.isEventStateOwner(DEMO_BOARD_ID, "V1"), true);
  assert.equal(app.goalEvents.readState(DEMO_BOARD_ID, "V1").work_status, "open");
});
