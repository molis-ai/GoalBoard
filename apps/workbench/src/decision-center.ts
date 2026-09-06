/** Workbench composes already-rendered owner contributions in Decision and Feed surfaces. */
type DecisionCenterIcon = "clipboard" | "plus" | "link" | "user" | "risk" | "check" | "input" | "chevron-down" | "workflow";
export interface WorkbenchDecisionGroup {
  ownerGoalId: string | null;
  item: { goal: { goal_id: string; title: string } } | null;
  humanReview: boolean;
  counts: { goalTree: number; contracts: number; candidates: number; rewires: number; risks: number };
  ownerLinkHtml: string;
  content: { goalTree: string; contracts: string; candidates: string; rewires: string; risks: string; review: string };
}
export interface WorkbenchDecisionCenterModel {
  groups: WorkbenchDecisionGroup[];
  count: number;
  typeCounts: { proposals: number; candidates: number; rewires: number; reviews: number; risks: number };
  recentHtml: string;
}
export interface WorkbenchDecisionCenterPrimitives {
  translate(text: string, values?: Record<string, string | number>): string;
  escapeHtml(value: unknown): string;
  icon(name: DecisionCenterIcon): string;
  currentLocale(): "zh" | "en";
  formatDate(value: string | null | undefined): string;
}
export function createWorkbenchDecisionCenterRenderer({ translate: L, escapeHtml, icon, currentLocale, formatDate }: WorkbenchDecisionCenterPrimitives) {
function renderDecisionCenter(model: WorkbenchDecisionCenterModel, desktopInbox = false): string {
  const { groups, count, typeCounts } = model;
  const groupKinds = (group: WorkbenchDecisionGroup) => [
    { count: group.counts.goalTree + group.counts.contracts, label: L("目标说明"), icon: "clipboard" as DecisionCenterIcon },
    { count: group.counts.candidates, label: L("新发现的工作"), icon: "plus" as DecisionCenterIcon },
    { count: group.counts.rewires, label: L("Goal 关系"), icon: "link" as DecisionCenterIcon },
    { count: group.humanReview ? 1 : 0, label: L("结果确认"), icon: "user" as DecisionCenterIcon },
    { count: group.counts.risks, label: L("风险处理"), icon: "risk" as DecisionCenterIcon },
  ].filter((item) => item.count > 0);
  if (!desktopInbox) {
    return `<article class="decision-center" data-decision-center>
      <header class="decision-center-header"><div><h1>${L("等待你的决定")}</h1><p>${L("每一项都会说明你在决定什么、为什么现在要决定、有没有可靠建议，以及选择后会发生什么。")}</p></div><strong>${count}<small>${L("项待处理")}</small></strong></header>
      <div class="decision-summary" aria-label="${L("待决定事项统计")}"><span>${L("目标说明")} <strong>${typeCounts.proposals}</strong></span><span>${L("新发现的工作")} <strong>${typeCounts.candidates}</strong></span><span>${L("Goal 关系")} <strong>${typeCounts.rewires}</strong></span><span>${L("结果确认")} <strong>${typeCounts.reviews}</strong></span><span>${L("风险处理")} <strong>${typeCounts.risks}</strong></span></div>
      ${groups.length ? `<div class="decision-groups">${groups.map((group) => {
        const goalId = group.item?.goal.goal_id ?? group.ownerGoalId ?? "board";
        return `<section class="decision-goal-group" id="decision-goal-${escapeHtml(goalId)}">
          <header class="decision-owner"><div><span>${L("这些决定属于")}</span>${group.ownerLinkHtml}</div><small>${group.counts.goalTree + group.counts.contracts + group.counts.candidates + group.counts.rewires + group.counts.risks + (group.humanReview ? 1 : 0)} ${L("项")}</small></header>
          <div class="decision-stack">
            ${group.content.goalTree}
            ${group.content.rewires}
            ${group.content.contracts}
            ${group.content.candidates}
            ${group.content.review}
            ${group.content.risks}
          </div>
        </section>`;
      }).join("")}</div>` : `<div class="decision-empty">${icon("check")}<h2>${L("当前没有等待你的决定")}</h2><p>${L("需要你确认目标、工作关系、结果或风险时，会自动出现在这里。")}</p><a href="/">${L("返回 Goal Tree")}</a></div>`}
      ${model.recentHtml}
    </article>`;
  }
  return `<article class="decision-center inbox-workspace" data-decision-center>
    <header class="decision-center-header inbox-header"><div><h1>Inbox</h1><p>${L("需要你判断后才能继续的事项，都集中在这里。")}</p></div><strong>${count}<small>${L("项待处理")}</small></strong></header>
    <div class="decision-summary" aria-label="${L("待决定事项统计")}"><span>${L("目标说明")} <strong>${typeCounts.proposals}</strong></span><span>${L("新发现的工作")} <strong>${typeCounts.candidates}</strong></span><span>${L("Goal 关系")} <strong>${typeCounts.rewires}</strong></span><span>${L("结果确认")} <strong>${typeCounts.reviews}</strong></span><span>${L("风险处理")} <strong>${typeCounts.risks}</strong></span></div>
    ${groups.length ? `<div class="decision-groups">${groups.map((group) => {
      const goalId = group.item?.goal.goal_id ?? group.ownerGoalId ?? "board";
      const kinds = groupKinds(group);
      const itemCount = kinds.reduce((total, kind) => total + kind.count, 0);
      const primaryKind = kinds[0] ?? { count: itemCount, label: L("待决定"), icon: "input" as DecisionCenterIcon };
      const ownerTitle = group.item?.goal.title ?? L("整个项目的事项");
      return `<details class="decision-goal-group inbox-group" id="decision-goal-${escapeHtml(goalId)}">
        <summary class="inbox-item"><span class="inbox-item-icon" aria-hidden="true">${icon(primaryKind.icon)}</span><span class="inbox-item-copy"><strong>${escapeHtml(ownerTitle)}</strong><small>${escapeHtml(kinds.map((kind) => kind.label).join(currentLocale() === "en" ? ", " : " · "))}</small></span><span class="inbox-item-types">${kinds.map((kind) => `<span>${icon(kind.icon)}${escapeHtml(kind.label)}${kind.count > 1 ? `<em>${kind.count}</em>` : ""}</span>`).join("")}</span><b>${itemCount}</b>${icon("chevron-down")}</summary>
        <div class="inbox-item-detail"><header class="decision-owner"><div><span>${L("这些决定属于")}</span>${group.ownerLinkHtml}</div><small>${itemCount} ${L("项")}</small></header>
        <div class="decision-stack">
          ${group.content.goalTree}
          ${group.content.rewires}
          ${group.content.contracts}
          ${group.content.candidates}
          ${group.content.review}
          ${group.content.risks}
        </div></div>
      </details>`;
    }).join("")}</div>` : `<div class="decision-empty">${icon("check")}<h2>${L("当前没有等待你的决定")}</h2><p>${L("需要你确认目标、工作关系、结果或风险时，会自动出现在这里。")}</p><a href="/">${L("返回 Goal Tree")}</a></div>`}
    ${model.recentHtml}
  </article>`;
}

function renderFeedDecisionGroupDetail(
  group: WorkbenchDecisionGroup,
  goalId: string,
  title: string,
  summary: string,
  updatedAt: string,
): string {
  const count = Object.values(group.counts).reduce((total, value) => total + value, 0) + (group.humanReview ? 1 : 0);
  return `<article class="feed-detail feed-detail--decision" data-feed-detail="decision:${escapeHtml(goalId)}">
    <header class="feed-detail-header"><div class="feed-detail-kicker"><span>Inbox Message</span><span>${L("Goal 决定")}</span><span>${L("待处理")}</span></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p><div class="feed-detail-meta"><span>${icon("workflow")}GoalBoard</span><time datetime="${escapeHtml(updatedAt)}">${formatDate(updatedAt)}</time></div></header>
    <section class="feed-decision-work"><header><div><span>${L("这些决定属于")}</span>${group.ownerLinkHtml}</div><small>${count} ${L("项")}</small></header><div class="decision-stack">
      ${group.content.goalTree}
      ${group.content.rewires}
      ${group.content.contracts}
      ${group.content.candidates}
      ${group.content.review}
      ${group.content.risks}
    </div></section>
  </article>`;
}
return { renderDecisionCenter, renderFeedDecisionGroupDetail };
}
