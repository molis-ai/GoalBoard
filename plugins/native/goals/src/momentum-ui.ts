import type { UiContribution } from "@adeptify/goalboard-contracts/platform/ui";
import type { GoalMomentumCadence, GoalMomentumNode, GoalMomentumAction } from "./momentum-model.js";
import type { GoalsMomentumItem, GoalsMomentumBoardView, GoalsMomentumUiPrimitives } from "./momentum-ui-model.js";
import { buildGoalMomentumView } from "./momentum-view.js";
import { treeDependencySearchText, visibleGoalStatus } from "./tree-presentation.js";

export const GOALS_MOMENTUM_UI_CONTRIBUTION_ID = "io.goalboard.native.goals.momentum.v1";

function createMomentumRenderer(primitives: GoalsMomentumUiPrimitives) {
  const { translate: L, escapeHtml, currentLocale, icon, renderVisibleGoalStatus } = primitives;
function momentumHeadline(cadence: GoalMomentumCadence, bottleneck?: GoalMomentumNode): string {
  const subject = bottleneck
    ? L("{title} 仍影响 {count} 个未完成下游。", { title: bottleneck.title, count: bottleneck.downstream_open_count })
    : L("当前没有形成明显下游瓶颈的 Goal。");
  if (cadence.stalled > cadence.completed) {
    return `${L("停滞多于最近完成，推进节奏正在变慢。")} ${subject}`;
  }
  if (cadence.completed > cadence.started) {
    return `${L("最近完成多于启动，项目正在收口。")} ${subject}`;
  }
  return `${L("推进保持流动，下一步优先处理高影响节点。")} ${subject}`;
}

function renderMomentumCadence(cadence: GoalMomentumCadence, bottleneck?: GoalMomentumNode): string {
  const maxValue = Math.max(
    1,
    ...cadence.buckets.map((bucket) => bucket.started + bucket.completed + bucket.blockers),
  );
  const buckets = cadence.buckets.map((bucket, index) => {
    const showLabel = cadence.days === 7 || index === 0 || index === cadence.buckets.length - 1 || index % 5 === 0;
    const startedHeight = Math.max(bucket.started ? 5 : 1, Math.round(bucket.started / maxValue * 54));
    const completedHeight = Math.max(bucket.completed ? 5 : 1, Math.round(bucket.completed / maxValue * 54));
    const blockerHeight = Math.max(bucket.blockers ? 5 : 1, Math.round(bucket.blockers / maxValue * 54));
    return `<span class="momentum-rail-day" data-momentum-day="${escapeHtml(bucket.date)}" title="${escapeHtml(`${bucket.date} · ${L("启动")} ${bucket.started} · ${L("完成")} ${bucket.completed} · ${L("新阻塞")} ${bucket.blockers}`)}"><i data-tone="started" style="--momentum-bar:${startedHeight}px"></i><i data-tone="completed" style="--momentum-bar:${completedHeight}px"></i><i data-tone="blocked" style="--momentum-bar:${blockerHeight}px"></i>${showLabel ? `<time datetime="${escapeHtml(bucket.date)}">${escapeHtml(bucket.date.slice(5))}</time>` : ""}</span>`;
  }).join("");
  return `<div class="momentum-cadence-panel" data-momentum-period-panel="${cadence.days}"${cadence.days === 7 ? "" : " hidden"}>
    <div class="momentum-cadence-copy">
      <p class="momentum-section-label">${L("推进节奏")}</p>
      <strong>${escapeHtml(momentumHeadline(cadence, bottleneck))}</strong>
      <p class="momentum-metrics"><span><b>${cadence.started}</b>${L("启动")}</span><span data-tone="good"><b>${cadence.completed}</b>${L("完成")}</span><span data-tone="bad"><b>${cadence.new_blockers}</b>${L("新阻塞")}</span><span data-tone="warn"><b>${cadence.stalled}</b>${L("停滞")}</span></p>
    </div>
    <div class="momentum-rail-wrap">
      <div class="momentum-rail-legend"><span data-tone="started"><i></i>${L("启动")}</span><span data-tone="completed"><i></i>${L("完成")}</span><span data-tone="blocked"><i></i>${L("新阻塞")}</span></div>
      <div class="momentum-rail" aria-label="${L("近 {days} 天 Goal 推进事件", { days: cadence.days })}">${buckets}</div>
      <p class="momentum-data-honesty">${icon("info")}<span>${cadence.history_incomplete > 0 ? L("{count} 个 Goal 历史不足，未计入停滞；所有数字均来自当前项目事件事实。", { count: cadence.history_incomplete }) : L("所有数字均来自当前项目事件事实；停滞只统计历史足够的 Goal。")}</span></p>
    </div>
  </div>`;
}

function momentumActionReason(
  action: GoalMomentumAction,
  byId: ReadonlyMap<string, GoalsMomentumItem>,
): string {
  const impact = action.downstream_open_count
    ? L("影响 {count} 个未完成下游", { count: action.downstream_open_count })
    : L("没有未完成下游");
  if (action.kind === "decide") return `${L("等待你的决定")} · ${impact}`;
  if (action.kind === "finish") return `${L("已进入执行或验收后段")} · ${impact}`;
  if (action.kind === "start_high_impact") return `${L("没有未满足前置")} · ${impact}`;
  if (action.kind === "start") return `${L("当前可以开始")} · ${impact}`;
  if (action.kind === "revive") return `${L("近 7 天没有推进活动")} · ${impact}`;
  const providers = action.unsatisfied_provider_goal_ids
    .map((goalId) => byId.get(goalId)?.goal.title ?? goalId)
    .join(currentLocale() === "en" ? ", " : "、");
  return providers ? L("仍在等待：{providers}", { providers }) : L("当前还不能直接开始");
}

function renderGoalMomentum(
  view: GoalsMomentumBoardView,
  selectedGoalId: string,
  items: readonly GoalsMomentumItem[],
): string {
  const byId = new Map(items.map((item) => [item.goal.goal_id, item]));
  const momentum = buildGoalMomentumView(
    items.map((item) => ({
      goal_id: item.goal.goal_id,
      title: item.goal.title,
      status: item.status,
      work_state: item.work_state ?? item.status,
      display_status: item.display_status,
      priority: item.goal.priority,
      created_at: item.goal.created_at,
      updated_at: item.goal.updated_at,
      completed: item.goal.fulfillment_state === "satisfied" || item.status === "archived" || item.work_state === "archived",
      acceptance_criteria_count: item.goal.acceptance_criteria.length,
      passed_criteria_count: item.passed_criteria.length,
      reasons: (item.reasons ?? []).map((reason) => ({ code: reason.code })),
      runs: item.runs.map((run) => ({
        role: run.role,
        state: run.state,
        started_at: run.started_at,
        ended_at: run.ended_at,
      })),
      evidence: item.evidence.map((evidence) => ({ captured_at: evidence.captured_at })),
      reviews: item.reviews.map((review) => ({ submitted_at: review.submitted_at })),
      risks: item.risks.map((risk) => ({
        risk_id: risk.risk_id,
        state: risk.state,
        blocking_mode: risk.blocking_mode,
        created_at: risk.created_at,
        updated_at: risk.updated_at,
      })),
      events: item.events.map((event) => ({ type: event.type, at: event.at })),
    })),
    view.snapshot.relations,
    selectedGoalId,
  );
  const bottleneck = [...momentum.nodes]
    .filter((node) => !node.completed && node.downstream_open_count > 0 && (node.blocked || node.stale))
    .sort((left, right) => right.downstream_open_count - left.downstream_open_count || left.title.localeCompare(right.title))[0];
  const edges = momentum.edges.map((edge, edgeIndex) => {
    const provider = byId.get(edge.provider_goal_id)?.goal.title ?? edge.provider_goal_id;
    const consumer = byId.get(edge.consumer_goal_id)?.goal.title ?? edge.consumer_goal_id;
    return `<g class="momentum-edge" data-graph-edge data-edge-index="${edgeIndex}" data-edge-id="${escapeHtml(edge.relation_id)}" data-edge-from="${escapeHtml(edge.provider_goal_id)}" data-edge-to="${escapeHtml(edge.consumer_goal_id)}" data-edge-type="depends_on">
      <path marker-end="url(#momentum-arrow)"></path>
      <title>${escapeHtml(`${provider} → ${consumer} · ${edge.reason}`)}</title>
    </g>`;
  }).join("");
  const groupFirstRowById = new Map(
    momentum.groups.map((group) => [group.group_id, group.row_start]),
  );
  const nodes = momentum.nodes.map((node) => {
    const item = byId.get(node.goal_id)!;
    const selected = node.goal_id === momentum.selected_goal_id;
    const searchValue = `${node.goal_id} ${node.title} ${treeDependencySearchText(item, view)}`.toLowerCase();
    const flags = [
      node.blocked ? L("阻塞") : node.startable ? L("可开始") : "",
      node.downstream_open_count > 1 ? L("影响 {count} 个下游", { count: node.downstream_open_count }) : "",
      !node.history_sufficient ? L("历史不足") : node.stale ? L("近 7 天停滞") : "",
    ].filter(Boolean).join(" · ");
    const bottleneck = !node.completed && node.downstream_open_count > 0 && (node.blocked || node.stale);
    const startsGroup = groupFirstRowById.get(node.group_id) === node.row;
    return `<button class="momentum-node momentum-node--${escapeHtml(item.status)}${selected ? " is-selected" : ""}${node.completed ? " is-complete" : ""}${bottleneck ? " is-bottleneck" : ""}${startsGroup ? " is-group-first-row" : ""}" type="button" data-graph-node data-momentum-node data-goal-id="${escapeHtml(node.goal_id)}" data-momentum-group-id="${escapeHtml(node.group_id)}" data-goal-search="${escapeHtml(searchValue)}" data-goal-status="${escapeHtml(visibleGoalStatus(item))}" data-goal-completed="${node.completed}" aria-pressed="${selected}" style="--momentum-column:${node.level + 1};--momentum-row:${node.row + 1}">
      <span class="momentum-node-kicker"><b>L${node.level}</b>${renderVisibleGoalStatus(item)}</span>
      <strong>${escapeHtml(node.title)}</strong>
      <small>${escapeHtml(flags || node.goal_id)}</small>
    </button>`;
  }).join("");
  const levelHeaders = Array.from({ length: momentum.level_count }, (_, level) =>
    `<span class="momentum-level" style="--momentum-column:${level + 1}"><b>L${level}</b>${level === 0 ? L("无前置 / 基础输入") : L("第 {level} 层消费", { level })}</span>`
  ).join("");
  const groups = momentum.groups.map((group) => {
    const title = group.root_goal_id
      ? `<button type="button" data-momentum-select="${escapeHtml(group.root_goal_id)}">${escapeHtml(group.title)}</button>`
      : `<span>${escapeHtml(group.title)}</span>`;
    return `<div class="momentum-group" data-momentum-group="${escapeHtml(group.group_id)}" style="--momentum-column-start:${group.level_start + 1};--momentum-column-end:${group.level_end + 2};--momentum-row-start:${group.row_start + 1};--momentum-row-end:${group.row_end + 2}"><header>${title}<small>${L("{count} 个 Goal", { count: group.goal_count })}</small></header></div>`;
  }).join("");
  const queue = momentum.actions.map((action, index) => {
    const item = byId.get(action.goal_id)!;
    const selected = action.goal_id === momentum.selected_goal_id;
    return `<li><button type="button" class="momentum-queue-item${selected ? " is-selected" : ""}" data-momentum-select="${escapeHtml(action.goal_id)}" data-momentum-action-kind="${action.kind}" aria-pressed="${selected}"><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${escapeHtml(item.goal.title)}</strong><small>${escapeHtml(momentumActionReason(action, byId))}</small></span>${renderVisibleGoalStatus(item)}</button></li>`;
  }).join("");
  const details = momentum.nodes.map((node) => {
    const item = byId.get(node.goal_id)!;
    const providers = node.unsatisfied_provider_goal_ids.map((goalId) => byId.get(goalId)?.goal.title ?? goalId);
    const currentReasons = (item.reasons ?? []).filter((reason) => reason.severity === "blocker").map((reason) => reason.message);
    const facts = [
      providers.length ? L("仍在等待：{providers}", { providers: providers.join(currentLocale() === "en" ? ", " : "、") }) : L("没有未满足前置"),
      L("可触达 {count} 个未完成下游", { count: node.downstream_open_count }),
      node.history_sufficient ? node.stale ? L("近 7 天没有可追溯推进活动") : L("近 7 天有可追溯推进活动") : L("历史不足，不能判断是否停滞"),
      ...currentReasons,
    ];
    return `<article class="momentum-selection" data-momentum-detail="${escapeHtml(node.goal_id)}"${node.goal_id === momentum.selected_goal_id ? "" : " hidden"}>
      <p class="momentum-section-label">${L("当前选择")}</p>
      <div class="momentum-selection-title"><div><h3>${escapeHtml(item.goal.title)}</h3><small>${escapeHtml(item.goal.goal_id)}</small></div>${renderVisibleGoalStatus(item)}</div>
      <dl><div><dt>${L("拓扑层级")}</dt><dd>L${node.level}</dd></div><div><dt>${L("完成标准")}</dt><dd>${node.passed_criteria_count}/${node.acceptance_criteria_count}</dd></div><div><dt>${L("下游影响")}</dt><dd>${node.downstream_open_count}</dd></div></dl>
      <ul>${facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}</ul>
      <a class="button-primary" href="/goals/${encodeURIComponent(node.goal_id)}">${L("打开 Goal")}${icon("arrow")}</a>
    </article>`;
  }).join("");
  const integrityCount = Object.values(momentum.integrity).reduce((count, values) => count + values.length, 0);
  const integrity = integrityCount
    ? `<p class="momentum-integrity">${icon("risk")}<span>${L("发现 {count} 处关系完整性问题；相关节点已保留并使用确定性降级布局。", { count: integrityCount })}</span></p>`
    : "";
  const empty = momentum.nodes.length === 0
    ? `<div class="momentum-empty">${icon("workflow")}<h2>${L("还没有可分析的 Goal")}</h2><p>${L("创建 Goal 并建立 depends_on 后，这里会显示完整推进拓扑和行动顺序。")}</p></div>`
    : "";
  return `<section class="goal-momentum" id="goal-momentum-pane" data-goal-momentum hidden aria-label="${L("Goal 推进态势")}">
    <header class="momentum-head">
      <div><h1>${L("先看推进是否流动，再决定现在做什么")}</h1><p>${L("时间变化、完整依赖拓扑和行动顺序共用同一份 GoalBoard 事实。")}</p></div>
      <div class="momentum-period-switch" role="group" aria-label="${L("时间窗口")}"><button class="is-active" type="button" data-momentum-period="7" aria-pressed="true">${L("近 7 天")}</button><button type="button" data-momentum-period="30" aria-pressed="false">${L("近 30 天")}</button></div>
    </header>
    <section class="momentum-cadence">${renderMomentumCadence(momentum.cadence[7], bottleneck)}${renderMomentumCadence(momentum.cadence[30], bottleneck)}</section>
    ${integrity}
    ${empty || `<div class="momentum-workbench">
      <section class="momentum-map-panel">
        <header class="momentum-panel-head"><div><h2>${L("完整 Goal 依赖拓扑")}</h2><p>${L("{goals} 个 Goal · {edges} 条 depends_on · 从提供者向消费者展开", { goals: momentum.nodes.length, edges: momentum.edges.length })}</p></div><div class="momentum-map-actions"><div class="momentum-map-filter" role="group" aria-label="${L("拓扑显示范围")}"><button class="is-active" type="button" data-momentum-filter="all" aria-pressed="true">${L("全部 {count}", { count: momentum.nodes.length })}</button><button type="button" data-momentum-filter="open" aria-pressed="false">${L("未完成 {count}", { count: momentum.nodes.filter((node) => !node.completed).length })}</button></div><div class="graph-zoom" role="group" aria-label="${L("拓扑缩放")}"><button type="button" data-graph-zoom="out" aria-label="${L("缩小")}">−</button><output data-graph-zoom-value>100%</output><button type="button" data-graph-zoom="in" aria-label="${L("放大")}">+</button><button type="button" data-graph-zoom="fit" aria-label="${L("适应宽度")}">${icon("maximize")}</button></div></div></header>
        <div class="graph-viewport momentum-map-scroll" data-graph-viewport tabindex="0" aria-label="${L("可缩放、拖动或使用键盘浏览的完整 Goal 依赖拓扑")}"><div class="graph-stage momentum-map" data-graph-stage data-graph-scale="1" style="--momentum-level-count:${Math.max(1, momentum.level_count)};--momentum-grid-rows:${Math.max(1, momentum.grid_rows + 1)}">${levelHeaders}${groups}<svg class="graph-edges momentum-edges" data-graph-edges aria-hidden="true"><defs><marker id="momentum-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs>${edges}</svg>${nodes}</div></div>
        <footer class="momentum-legend"><span><i data-kind="dependency"></i>${L("depends_on：前置提供者 → 消费者")}</span><span><i data-kind="selected"></i>${L("当前选择的一阶依赖")}</span><span><i data-kind="group"></i>${L("分组带表达 part_of")}</span><small>${L("完成节点保留并弱化；瓶颈只是一种状态")}</small></footer>
      </section>
      <section class="momentum-queue-panel"><div class="momentum-queue-column"><header class="momentum-panel-head"><div><h2>${L("行动队列")}</h2><p>${L("排序只使用阻塞、推进阶段、前置与下游影响")}</p></div></header><ol class="momentum-queue-list">${queue}</ol></div><div class="momentum-selection-column">${details}</div></section>
    </div>`}
  </section>`;
}


  function renderMomentumPlaceholder(): string {
    return `<section class="goal-momentum" id="goal-momentum-pane" data-goal-momentum data-loaded="false" hidden aria-label="${L("Goal 推进态势")}"><p class="empty-row momentum-lazy-status" data-goal-momentum-status role="status">${L("打开推进态势时载入")}</p><button type="button" data-retry-goal-momentum hidden>${L("重试")}</button></section>`;
  }
  return { renderGoalMomentum, renderMomentumPlaceholder };
}
export type GoalsMomentumRenderer = ReturnType<typeof createMomentumRenderer>;
export type GoalsMomentumUiModel = { primitives: GoalsMomentumUiPrimitives } & (
  | { kind: "momentum"; args: Parameters<GoalsMomentumRenderer["renderGoalMomentum"]> }
  | { kind: "placeholder"; args: [] }
);
export const goalsMomentumUiContribution: UiContribution<GoalsMomentumUiModel> = {
  descriptor: {
    contribution_id: GOALS_MOMENTUM_UI_CONTRIBUTION_ID, plugin_id: "io.goalboard.native.goals", kind: "embedded", label: "Goal momentum",
    surfaces: ["momentum", "placeholder"].map(surface_id => ({ surface_id, target_slot_id: "workbench.main", format: "declarative-html" })), slots: [],
  },
  render({ surface, model }) {
    if (surface !== model.kind) throw new Error("Goals momentum surface does not match its model");
    const renderer = createMomentumRenderer(model.primitives);
    return model.kind === "momentum" ? renderer.renderGoalMomentum(...model.args) : renderer.renderMomentumPlaceholder();
  },
};
