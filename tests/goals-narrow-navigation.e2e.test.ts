import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_BOARD_ID, GoalProjectApplication } from "@adeptify/goalboard-app-local-host";
import { openGoalBrowser } from "./fixtures/goal-browser.js";

const SNAPSHOT = `(() => {
  const workspace = document.querySelector("[data-workspace]");
  const measure = (el) => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      display: style.display,
      hidden: el.hidden,
      inert: el.hasAttribute("inert"),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    };
  };
  const hit = (x, y) => {
    const node = document.elementFromPoint(x, y);
    if (!node) return "";
    if (node.closest(".tree-pane")) return "tree";
    if (node.closest(".document-pane")) return "document";
    if (node.closest(".tui-pane")) return "tui";
    if (node.closest(".goal-momentum")) return "graph";
    if (node.closest(".mobile-switch")) return "switch";
    return node.tagName.toLowerCase();
  };
  const workspaceRect = workspace?.getBoundingClientRect();
  const center = workspaceRect
    ? { x: workspaceRect.x + workspaceRect.width / 2, y: workspaceRect.y + Math.max(40, workspaceRect.height / 2) }
    : { x: innerWidth / 2, y: innerHeight / 2 };
  const tabs = [...document.querySelectorAll(".mobile-switch [role='tab']")].map((button) => {
    const rect = button.getBoundingClientRect();
    return {
      target: button.dataset.mobileTarget || (button.hasAttribute("data-mobile-directory-root") ? "root" : ""),
      label: (button.textContent || "").trim(),
      selected: button.getAttribute("aria-selected") === "true",
      active: button.classList.contains("is-active"),
      h: Math.round(rect.height),
      w: Math.round(rect.width),
    };
  });
  return {
    width: innerWidth,
    height: innerHeight,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
    mobileView: workspace?.dataset.mobileView || "",
    workspaceMode: workspace?.dataset.workspaceMode || "",
    directory: document.querySelector(".tree-pane")?.dataset.desktopDirectory || "",
    tree: measure(document.querySelector(".tree-pane")),
    list: measure(document.querySelector(".goal-list-view")),
    document: measure(document.querySelector(".document-pane")),
    tui: measure(document.querySelector(".tui-pane")),
    graph: measure(document.querySelector(".goal-momentum")),
    hit: hit(center.x, center.y),
    tabs,
    selectedTabs: tabs.filter((tab) => tab.selected || tab.active).map((tab) => tab.target),
    treeAriaControls: document.querySelector('[data-mobile-target="tree"]')?.getAttribute("aria-controls") || "",
    documentAriaControls: document.querySelector('[data-mobile-target="document"]')?.getAttribute("aria-controls") || "",
    activeTag: document.activeElement?.tagName || "",
    activeClass: document.activeElement instanceof HTMLElement ? document.activeElement.className : "",
    projectMenuOpen: Boolean(document.querySelector(".mobile-project-bar details.navigator-project-menu")?.open),
    markerBottom: getComputedStyle(document.querySelector(".mobile-switch button.is-active") || document.body, "::after").bottom,
    searchVisible: (() => {
      const search = document.querySelector("[data-global-search]");
      if (!search) return false;
      const rect = search.getBoundingClientRect();
      return getComputedStyle(search).display !== "none" && rect.width > 0 && rect.height > 0;
    })(),
  };
})()`;

type PaneSnapshot = {
  width: number;
  height: number;
  overflowX: boolean;
  mobileView: string;
  workspaceMode: string;
  directory: string;
  tree: { display: string; hidden: boolean; inert: boolean; x: number; y: number; w: number; h: number } | null;
  list: { display: string; hidden: boolean; inert: boolean; x: number; y: number; w: number; h: number } | null;
  document: { display: string; hidden: boolean; inert: boolean; x: number; y: number; w: number; h: number } | null;
  tui: { display: string; hidden: boolean; inert: boolean; x: number; y: number; w: number; h: number } | null;
  graph: { display: string; hidden: boolean; inert: boolean; x: number; y: number; w: number; h: number } | null;
  hit: string;
  tabs: { target: string; label: string; selected: boolean; active: boolean; h: number; w: number }[];
  selectedTabs: string[];
  treeAriaControls: string;
  documentAriaControls: string;
  activeTag: string;
  activeClass: string;
  projectMenuOpen: boolean;
  markerBottom: string;
  searchVisible: boolean;
};

function isShown(pane: PaneSnapshot["tree"]): boolean {
  return Boolean(pane && pane.display !== "none" && pane.h >= 180 && pane.w >= 180);
}

function isHiddenFromUse(pane: PaneSnapshot["tree"]): boolean {
  return !pane || pane.display === "none" || pane.h < 8 || pane.w < 8;
}

test("narrow Goal switch shows the list, restores the stored view, and keeps one tab", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate, reloadPage } = browser;
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 721, height: 936, deviceScaleFactor: 1, mobile: true }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/INTERFACES?desktop=1" }, sessionId));
  await waitFor("document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'INTERFACES'");
  const snap = () => evaluate<PaneSnapshot>(SNAPSHOT);
  const waitList = () => waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tree" && getComputedStyle(document.querySelector(".tree-pane")).display !== "none" && document.querySelector(".tree-pane").getBoundingClientRect().height > 180 && getComputedStyle(document.querySelector(".document-pane")).display === "none"`);
  const waitDocument = () => waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "document" && getComputedStyle(document.querySelector(".document-pane")).display !== "none" && document.querySelector(".document-pane").getBoundingClientRect().height > 180 && getComputedStyle(document.querySelector(".tree-pane")).display === "none"`);

  let state = await snap();
  assert.equal(state.mobileView, "document", "direct Goal URL opens focus");
  assert.equal(isShown(state.document), true);
  assert.equal(isHiddenFromUse(state.tree), true);

  await click('[data-mobile-target="tree"]');
  await waitList();
  state = await snap();
  assert.equal(state.directory, "goals");
  assert.equal(isShown(state.tree), true);
  assert.equal(isHiddenFromUse(state.document), true);
  assert.equal(isHiddenFromUse(state.graph), true);
  assert.equal(state.hit, "tree");
  assert.equal(state.searchVisible, true);
  assert.deepEqual(state.selectedTabs, ["tree"]);
  assert.equal(state.treeAriaControls, "goal-tree-pane");
  assert.ok(state.tabs.every((tab) => tab.h >= 44));
  assert.equal(state.markerBottom, "0px");
  assert.equal(state.tree?.inert, false);
  assert.equal(state.document?.inert, true);

  await click("[data-mobile-directory-root]");
  await waitFor(`document.querySelector(".tree-pane").dataset.desktopDirectory === "root" && getComputedStyle(document.querySelector(".tree-pane")).display !== "none"`);
  state = await snap();
  assert.deepEqual(state.selectedTabs, ["root"]);
  await click('[data-mobile-target="tree"]');
  await waitList();
  state = await snap();
  assert.equal(state.directory, "goals");
  assert.equal(isShown(state.tree), true);
  assert.deepEqual(state.selectedTabs, ["tree"]);

  await click("[data-mobile-directory-root]");
  await waitFor(`document.querySelector(".tree-pane").dataset.desktopDirectory === "root"`);
  await click('[data-directory-open="feed"][data-work-surface-open="feed"][data-feed-preset="inbox_message"]');
  await waitFor(`document.querySelector(".tree-pane").dataset.desktopDirectory === "feed" && document.querySelector("[data-workspace]").dataset.mobileView === "tree"`);
  const feedLabel = await evaluate<string>("document.querySelector('[data-mobile-target=\"tree\"]').textContent.trim()");
  assert.match(feedLabel, /Inbox|Feed/);
  await click("[data-mobile-directory-root]");
  await waitFor(`document.querySelector(".tree-pane").dataset.desktopDirectory === "root"`);
  await click('[data-mobile-target="tree"]');
  await waitFor(`document.querySelector(".tree-pane").dataset.desktopDirectory === "feed" && getComputedStyle(document.querySelector(".tree-pane")).display !== "none"`);
  state = await snap();
  assert.equal(state.directory, "feed");
  assert.deepEqual(state.selectedTabs, ["tree"]);
  assert.match(state.tabs.find((tab) => tab.target === "tree")?.label || "", /Inbox|Feed/);

  await click("[data-mobile-directory-root]");
  await click('[data-directory-open="goals"][data-work-surface-open="goal"]');
  await waitList();

  await click('.tree-node[data-select-goal="INTERFACES"]');
  await waitDocument();
  state = await snap();
  assert.equal(state.hit, "document");
  assert.equal(isShown(state.document), true);
  assert.equal(isHiddenFromUse(state.tree), true);
  assert.equal(state.tree?.inert, true);
  assert.equal(state.document?.inert, false);
  assert.deepEqual(state.selectedTabs, ["document"]);

  await click('[data-mobile-target="tree"]');
  await waitList();
  await command("Network.setBlockedURLs", { urls: [origin + "/api/goals/CORE/document*"] }, sessionId);
  await click('.tree-node[data-select-goal="CORE"]');
  await waitFor("document.querySelector('[data-toast]').textContent.includes('Failed to fetch') && document.querySelector('[data-workspace]').dataset.mobileView === 'tree'");
  state = await snap();
  assert.equal(isShown(state.tree), true);
  assert.equal(await evaluate("document.querySelector('[data-goal-event-document]')?.dataset.goalView"), "INTERFACES");
  await command("Network.setBlockedURLs", { urls: [] }, sessionId);
  await click('.tree-node[data-select-goal="CORE"]');
  await waitFor("document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'CORE' && document.querySelector('[data-workspace]').dataset.mobileView === 'document'");
  await waitDocument();

  await click('[data-mobile-target="tree"]');
  await waitList();
  const afterNavigation = store.snapshot(DEMO_BOARD_ID);
  assert.deepEqual(afterNavigation.goals, before.goals);
  assert.deepEqual(afterNavigation.relations, before.relations);
  assert.deepEqual(afterNavigation.runs, before.runs);

  const app = new GoalProjectApplication(store);
  const beforeCursor = await evaluate<number>("Number(document.querySelector('[data-goal-event-document]')?.dataset.goalEventCursor || 0)");
  const note = app.goalEvents.recordNote({
    board_id: DEMO_BOARD_ID,
    goal_id: "CORE",
    actor_id: "web-user",
    actor_kind: "user",
    body: "narrow-nav refresh note",
    idempotency_key: "narrow-nav-refresh-note",
  });
  assert.equal(note.recorded, true);
  await evaluate("document.dispatchEvent(new Event('visibilitychange')); true");
  await waitFor(`Number(document.querySelector('[data-goal-event-document]')?.dataset.goalEventCursor || 0) > ${beforeCursor} && document.querySelector("[data-workspace]").dataset.mobileView === "tree" && getComputedStyle(document.querySelector(".tree-pane")).display !== "none"`);
  state = await snap();
  assert.equal(isShown(state.tree), true);
  assert.match(await evaluate<string>("document.querySelector('[data-goal-event-document]')?.textContent || ''"), /narrow-nav refresh note/);

  await reloadPage();
  await waitFor("document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'CORE'");
  await waitList();
  state = await snap();
  assert.equal(state.mobileView, "tree");
  assert.equal(isShown(state.tree), true);

  assert.equal(await evaluate("Boolean(document.querySelector('[data-mobile-target=\"tui\"]'))"), true);
  await click('[data-mobile-target="tui"]');
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tui" && getComputedStyle(document.querySelector(".tui-pane")).display !== "none"`);
  await reloadPage();
  await waitFor("document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'CORE'");
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tui" && document.querySelector("[data-workspace]").dataset.workspaceMode === "runtime" && getComputedStyle(document.querySelector(".tui-pane")).display !== "none"`);
  state = await snap();
  assert.equal(state.workspaceMode, "runtime");
  assert.equal(isHiddenFromUse(state.tree), true);
  await click('[data-mobile-target="tree"]');
  await waitList();

  const after = store.snapshot(DEMO_BOARD_ID);
  assert.deepEqual(after.goals, before.goals);
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.runs, before.runs);
  assert.ok(app.goalEvents.readState(DEMO_BOARD_ID, "CORE").goal_event_cursor > beforeCursor);
});

test("narrow list, graph return, keyboard switch and desktop side-by-side keep usable geometry", { timeout: 60_000 }, async (t) => {
  const browser = await openGoalBrowser(t);
  if (!browser) return;
  const { store, before, origin, sessionId, command, evaluate, waitFor, click, navigate } = browser;
  await command("Network.enable", {}, sessionId);
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await navigate(() => command("Page.navigate", { url: origin + "/goals/INTERFACES" }, sessionId));
  await waitFor("document.querySelector('[data-goal-event-document]')?.dataset.goalView === 'INTERFACES'");
  const snap = () => evaluate<PaneSnapshot>(SNAPSHOT);
  const waitGraph = () => waitFor(`document.querySelector("[data-workspace]").dataset.workspaceMode === "graph" && document.querySelector("#goal-momentum-pane") && !document.querySelector("#goal-momentum-pane").hidden && getComputedStyle(document.querySelector("#goal-momentum-pane")).display !== "none" && document.querySelector("#goal-momentum-pane").getBoundingClientRect().height > 180`);

  await click('[data-mobile-target="tree"]');
  await waitFor(`getComputedStyle(document.querySelector(".tree-pane")).display !== "none" && document.querySelector(".tree-pane").getBoundingClientRect().height > 180`);
  let state = await snap();
  assert.equal(state.width, 390);
  assert.equal(state.overflowX, false);
  assert.equal(isShown(state.tree), true);
  assert.equal(isHiddenFromUse(state.document), true);
  assert.ok(state.tabs.every((tab) => tab.h >= 44));
  assert.equal(state.markerBottom, "0px");
  assert.deepEqual(state.selectedTabs, ["tree"]);

  await click('[data-mobile-target="document"]');
  await waitFor(`getComputedStyle(document.querySelector(".document-pane")).display !== "none" && document.querySelector(".document-pane").getBoundingClientRect().height > 180`);
  state = await snap();
  assert.equal(state.overflowX, false);
  assert.equal(isShown(state.document), true);
  assert.equal(state.hit, "document");

  await click('[data-mobile-target="tree"]');
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tree"`);
  await waitFor("document.querySelector('.mobile-project-bar .navigator-project-selector')?.getBoundingClientRect().height > 0");
  await click(".mobile-project-bar .navigator-project-selector");
  await evaluate(`document.querySelector(".mobile-project-bar .navigator-project-selector").focus(); true`);
  await waitFor("document.activeElement?.classList.contains('navigator-project-selector') && document.querySelector('.mobile-project-bar details.navigator-project-menu')?.open === true");
  await command("Emulation.setDeviceMetricsOverride", { width: 721, height: 936, deviceScaleFactor: 1, mobile: true }, sessionId);
  await evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  state = await snap();
  assert.match(state.activeClass, /navigator-project-selector/);
  assert.equal(state.projectMenuOpen, true);

  await evaluate("document.querySelector('.mobile-project-bar details.navigator-project-menu').open = false; true");
  assert.equal(await evaluate("Boolean(document.querySelector('[data-navigator-view=\"graph\"]'))"), true);
  await click('[data-navigator-view="graph"]');
  await waitGraph();
  state = await snap();
  assert.equal(isShown(state.graph), true);
  assert.equal(isHiddenFromUse(state.document), true);
  assert.equal(isHiddenFromUse(state.tree), true);
  assert.equal(state.hit, "graph");
  assert.deepEqual(state.selectedTabs, ["tree"]);
  assert.equal(state.treeAriaControls, "goal-momentum-pane");
  assert.equal(state.documentAriaControls, "goal-document-pane");

  await click('[data-mobile-target="tree"]');
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tree" && getComputedStyle(document.querySelector(".tree-pane")).display !== "none"`);
  state = await snap();
  assert.equal(isShown(state.tree), true);
  assert.equal(isHiddenFromUse(state.graph), true);
  assert.equal(state.hit, "tree");
  assert.deepEqual(state.selectedTabs, ["tree"]);
  assert.equal(state.treeAriaControls, "goal-tree-pane");

  await click('[data-navigator-view="graph"]');
  await waitGraph();
  await click('[data-mobile-target="document"]');
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "document" && document.querySelector("[data-workspace]").dataset.workspaceMode === "focus" && getComputedStyle(document.querySelector(".document-pane")).display !== "none"`);
  state = await snap();
  assert.equal(isShown(state.document), true);
  assert.equal(isHiddenFromUse(state.graph), true);
  assert.deepEqual(state.selectedTabs, ["document"]);
  assert.equal(state.treeAriaControls, "goal-tree-pane");

  await click('[data-mobile-target="tree"]');
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tree"`);
  await evaluate(`document.querySelector('[data-mobile-target="tree"]').focus(); true`);
  await command("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 }, sessionId);
  await command("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", windowsVirtualKeyCode: 39, nativeVirtualKeyCode: 39 }, sessionId);
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "document" && getComputedStyle(document.querySelector(".document-pane")).display !== "none"`);
  state = await snap();
  assert.deepEqual(state.selectedTabs, ["document"]);
  assert.equal(isShown(state.document), true);

  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  await waitFor(`document.querySelector(".tree-pane").getBoundingClientRect().width > 180 && document.querySelector(".document-pane").getBoundingClientRect().width > 180`);
  state = await snap();
  assert.ok(state.tree && state.document);
  assert.ok(state.tree.w > 180 && state.tree.h > 180);
  assert.ok(state.document.w > 180 && state.document.h > 180);
  assert.ok(state.tree.x + state.tree.w <= state.document.x + 8, "desktop tree and document sit side by side");
  assert.equal(state.tree.inert, false);
  assert.equal(state.document.inert, false);

  await click('[data-navigator-view="graph"]');
  await waitGraph();
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await evaluate("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await waitFor(`document.querySelector("[data-workspace]").dataset.workspaceMode === "graph" && document.querySelector("[data-workspace]").dataset.mobileView === "document" && document.querySelector("#goal-momentum-pane") && !document.querySelector("#goal-momentum-pane").hidden && getComputedStyle(document.querySelector("#goal-momentum-pane")).display !== "none" && document.querySelector("#goal-momentum-pane").getBoundingClientRect().height > 180`);
  state = await snap();
  assert.equal(state.width, 390);
  assert.equal(state.workspaceMode, "graph");
  assert.equal(state.mobileView, "document");
  assert.equal(isShown(state.graph), true);
  assert.equal(isHiddenFromUse(state.tree), true);
  assert.equal(isHiddenFromUse(state.document), true);
  assert.equal(state.hit, "graph");
  assert.deepEqual(state.selectedTabs, ["tree"]);
  assert.equal(state.treeAriaControls, "goal-momentum-pane");

  await click('[data-mobile-target="tree"]');
  await waitFor(`document.querySelector("[data-workspace]").dataset.mobileView === "tree" && document.querySelector("[data-workspace]").dataset.workspaceMode === "focus" && getComputedStyle(document.querySelector(".tree-pane")).display !== "none" && document.querySelector(".tree-pane").getBoundingClientRect().height > 180 && getComputedStyle(document.querySelector(".goal-list-view")).display !== "none" && document.querySelector(".goal-list-view").getBoundingClientRect().height > 0`);
  state = await snap();
  assert.equal(isShown(state.tree), true);
  assert.ok(state.list && state.list.display !== "none" && state.list.h > 0 && state.list.w > 0, "Goal list is visible with nonzero geometry after leaving graph");
  assert.equal(isHiddenFromUse(state.graph), true);
  assert.deepEqual(state.selectedTabs, ["tree"]);
  assert.equal(state.treeAriaControls, "goal-tree-pane");

  const after = store.snapshot(DEMO_BOARD_ID);
  assert.deepEqual(after.goals, before.goals);
  assert.deepEqual(after.relations, before.relations);
  assert.deepEqual(after.runs, before.runs);
});
