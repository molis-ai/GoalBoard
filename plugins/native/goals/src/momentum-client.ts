import { GOALS_MOMENTUM_VIEWPORT_FACTORY_SCRIPT } from "./momentum-viewport-client.js";
/** Goal momentum selection, filters, loading and event behavior. Shared navigation/save remain host dependencies. */
const GOALS_MOMENTUM_STATE_SCRIPT = `    const updateMomentumSelection = (goalId, persist = true) => {
      const graph = graphElement();
      if (!graph?.querySelector('[data-momentum-node][data-goal-id="' + CSS.escape(goalId || "") + '"]')) return;
      momentumSelected = goalId;
      const relatedGoalIds = new Set([goalId]);
      const defaultMarker = graph.querySelector("#momentum-arrow");
      if (defaultMarker && !graph.querySelector("#momentum-arrow-selected")) {
        const selectedMarker = defaultMarker.cloneNode(true);
        selectedMarker.id = "momentum-arrow-selected";
        defaultMarker.after(selectedMarker);
      }
      graph.querySelectorAll("[data-graph-edge]").forEach((edge) => {
        const related = edge.dataset.edgeFrom === goalId || edge.dataset.edgeTo === goalId;
        edge.classList.toggle("is-selected-path", related);
        edge.querySelector("path")?.setAttribute(
          "marker-end",
          related ? "url(#momentum-arrow-selected)" : "url(#momentum-arrow)",
        );
        if (related && edge.dataset.edgeFrom) relatedGoalIds.add(edge.dataset.edgeFrom);
        if (related && edge.dataset.edgeTo) relatedGoalIds.add(edge.dataset.edgeTo);
      });
      graph.querySelectorAll("[data-momentum-node]").forEach((node) => {
        const active = node.dataset.goalId === goalId;
        node.classList.toggle("is-selected", active);
        node.classList.toggle("is-connected-path", !active && relatedGoalIds.has(node.dataset.goalId));
        node.setAttribute("aria-pressed", String(active));
      });
      graph.querySelectorAll("[data-momentum-select]").forEach((button) => {
        const active = button.dataset.momentumSelect === goalId;
        button.classList.toggle("is-selected", active);
        if (button.matches(".momentum-queue-item")) button.setAttribute("aria-pressed", String(active));
      });
      graph.querySelectorAll("[data-momentum-detail]").forEach((detail) => {
        detail.hidden = detail.dataset.momentumDetail !== goalId;
      });
      requestAnimationFrame(drawGoalGraph);
      if (persist) queueSave();
    };

    const updateGraphVisibility = () => {
      const graph = graphElement();
      if (!graph) return;
      graph.dataset.filter = momentumOpenOnly ? "open" : "all";
      const query = String(treeSearch.value || "").trim().toLowerCase();
      const selectedStatuses = new Set(getSelectedStatuses());
      const visibleNodeIds = new Set();
      graph.querySelectorAll("[data-graph-node]").forEach((node) => {
        const matchesQuery = !query || String(node.dataset.goalSearch || "").includes(query);
        const matchesStatus = selectedStatuses.size === 0 || selectedStatuses.has(node.dataset.goalStatus);
        const matchesCompletion = !momentumOpenOnly || node.dataset.goalCompleted !== "true";
        node.hidden = !(matchesQuery && matchesStatus && matchesCompletion);
        if (!node.hidden) visibleNodeIds.add(node.dataset.goalId);
      });
      graph.querySelectorAll("[data-graph-edge]").forEach((edge) => {
        const hidden = !visibleNodeIds.has(edge.dataset.edgeFrom) ||
          !visibleNodeIds.has(edge.dataset.edgeTo);
        edge.toggleAttribute("hidden", hidden);
      });
      graph.querySelectorAll("[data-momentum-group]").forEach((group) => {
        const hasVisibleNode = [...graph.querySelectorAll("[data-momentum-node]")]
          .some((node) => !node.hidden && node.dataset.momentumGroupId === group.dataset.momentumGroup);
        group.toggleAttribute("hidden", !hasVisibleNode);
      });
      graph.querySelectorAll("[data-momentum-filter]").forEach((button) => {
        const active = button.dataset.momentumFilter === (momentumOpenOnly ? "open" : "all");
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      updateMomentumSelection(momentumSelected || getSelected(), false);
      requestAnimationFrame(() => graphAutoFit ? fitGoalGraph(false) : drawGoalGraph());
    };

    const setMomentumPeriod = (value, persist = true) => {
      const graph = graphElement();
      momentumPeriod = Number(value) === 30 ? 30 : 7;
      graph?.querySelectorAll("[data-momentum-period]").forEach((button) => {
        const active = Number(button.dataset.momentumPeriod) === momentumPeriod;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      graph?.querySelectorAll("[data-momentum-period-panel]").forEach((panel) => {
        panel.hidden = Number(panel.dataset.momentumPeriodPanel) !== momentumPeriod;
      });
      if (persist) queueSave();
    };

    const setGraphZoom = (value, persist = true, autoFit = false) => {
      const graph = graphElement();
      const stage = graph?.querySelector("[data-graph-stage]");
      graphAutoFit = autoFit;
      graphZoom = Math.min(1.25, Math.max(.55, Math.round((Number(value) || 1) * 100) / 100));
      if (stage) {
        stage.dataset.graphScale = String(graphZoom);
        stage.style.zoom = String(graphZoom);
      }
      const output = graph?.querySelector("[data-graph-zoom-value]");
      if (output) output.textContent = Math.round(graphZoom * 100) + "%";
      graph?.querySelector('[data-graph-zoom="out"]')?.toggleAttribute("disabled", graphZoom <= .55);
      graph?.querySelector('[data-graph-zoom="in"]')?.toggleAttribute("disabled", graphZoom >= 1.25);
      requestAnimationFrame(drawGoalGraph);
      if (persist) queueSave();
    };

    const fitGoalGraph = (persist = true) => {
      const graph = graphElement();
      const viewport = graph?.querySelector("[data-graph-viewport]");
      const stage = graph?.querySelector("[data-graph-stage]");
      if (!viewport || !stage) return;
      const availableWidth = Math.max(1, viewport.clientWidth - 24);
      const scale = Math.min(1, availableWidth / stage.offsetWidth);
      setGraphZoom(scale, persist, true);
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    };

    const loadGoalGraph = async (force = false) => {
      const graph = graphElement();
      if (!graph || (!force && graph.dataset.loaded === "true")) return true;
      if (goalGraphRequest) return goalGraphRequest;
      const status = graph.querySelector("[data-goal-momentum-status]");
      const retry = graph.querySelector("[data-retry-goal-momentum]");
      if (status) status.textContent = L("正在载入推进态势…");
      if (retry) retry.hidden = true;
      graph.setAttribute("aria-busy", "true");
      goalGraphRequest = (async () => {
        try {
          const response = await fetch(
            route("/api/board/momentum?view=" + documentCollection + "&goal_id=" + encodeURIComponent(momentumSelected || getSelected() || "")),
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error(L("无法载入推进态势"));
          const template = document.createElement("template");
          template.innerHTML = (await response.text()).trim();
          const nextGraph = template.content.querySelector("[data-goal-momentum]");
          if (!nextGraph) throw new Error(L("推进态势响应不完整"));
          nextGraph.dataset.loaded = "true";
          graph.replaceWith(nextGraph);
          setWorkspaceMode("graph", false);
          bindGoalGraphViewport();
          if (graphAutoFit) requestAnimationFrame(() => fitGoalGraph(false));
          else setGraphZoom(graphZoom, false, false);
          setMomentumPeriod(momentumPeriod, false);
          updateGraphVisibility();
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : L("无法载入推进态势");
          if (status) status.textContent = message;
          if (retry) retry.hidden = false;
          return false;
        } finally {
          graph.removeAttribute("aria-busy");
          goalGraphRequest = null;
        }
      })();
      return goalGraphRequest;
    };

`;

const GOALS_MOMENTUM_NAVIGATION_SCRIPT = `      if (target.closest("[data-retry-goal-momentum]")) {
        void loadGoalGraph();
        return true;
      }
      const navigatorViewButton = target.closest("button[data-navigator-view]");
      if (navigatorViewButton) {
        setNavigatorView(navigatorViewButton.dataset.navigatorView);
        return true;
      }
      return false;
`;

const GOALS_MOMENTUM_SELECTION_SCRIPT = `      const momentumFilterButton = target.closest("[data-momentum-filter]");
      if (momentumFilterButton) {
        momentumOpenOnly = momentumFilterButton.dataset.momentumFilter === "open";
        updateGraphVisibility();
        queueSave();
        return true;
      }
      const momentumPeriodButton = target.closest("[data-momentum-period]");
      if (momentumPeriodButton) {
        setMomentumPeriod(momentumPeriodButton.dataset.momentumPeriod);
        return true;
      }
      const momentumSelectButton = target.closest("[data-momentum-select], [data-momentum-node]");
      if (momentumSelectButton) {
        updateMomentumSelection(momentumSelectButton.dataset.momentumSelect || momentumSelectButton.dataset.goalId);
        return true;
      }
      return false;
`;

const GOALS_MOMENTUM_ZOOM_SCRIPT = `      const graphZoomButton = target.closest("[data-graph-zoom]");
      if (graphZoomButton) {
        const action = graphZoomButton.dataset.graphZoom;
        if (action === "fit") {
          fitGoalGraph();
        } else {
          setGraphZoom(action === "in" ? graphZoom + .1 : graphZoom - .1, true, false);
        }
        return true;
      }
      return false;
`;

export const GOALS_MOMENTUM_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { workspace, treeSearch, documentCollection, route, getSelected,
      getSelectedStatuses, translate: L, queueSave, setWorkspaceMode, setNavigatorView } = host;
    let momentumOpenOnly = false;
    let momentumPeriod = 7;
    let momentumSelected = getSelected();
    let graphZoom = 1;
    let graphAutoFit = true;
    let goalGraphRequest = null;
    const graphElement = () => workspace.querySelector("[data-goal-momentum]");
    const { drawGoalGraph, bindGoalGraphViewport } = (${GOALS_MOMENTUM_VIEWPORT_FACTORY_SCRIPT})({
      graphElement, isAutoFit: () => graphAutoFit, fitGoalGraph: (...args) => fitGoalGraph(...args),
    });
${GOALS_MOMENTUM_STATE_SCRIPT}
    const readMomentumState = () => ({ momentumOpenOnly, momentumPeriod, momentumSelected, graphZoom, graphAutoFit });
    const restoreMomentumState = (ui) => {
      momentumOpenOnly = ui?.momentumOpenOnly === true;
      momentumPeriod = Number(ui?.momentumPeriod) === 30 ? 30 : 7;
      momentumSelected = String(ui?.momentumSelected || getSelected() || "");
      graphZoom = Number(ui?.graphZoom) || graphZoom;
      graphAutoFit = ui?.graphAutoFit !== false;
    };
    const rememberMomentumGoal = (goalId) => { momentumSelected = goalId; };
    const scheduleGoalGraphLayout = () => requestAnimationFrame(() => graphAutoFit ? fitGoalGraph(false) : drawGoalGraph());
    const restoreGoalGraphViewport = () => {
      bindGoalGraphViewport();
      if (graphAutoFit) requestAnimationFrame(() => fitGoalGraph(false));
      else setGraphZoom(graphZoom, false, false);
    };
    const handleMomentumNavigationClick = (target) => {
${GOALS_MOMENTUM_NAVIGATION_SCRIPT}    };
    const handleMomentumSelectionClick = (target) => {
${GOALS_MOMENTUM_SELECTION_SCRIPT}    };
    const handleMomentumZoomClick = (target) => {
${GOALS_MOMENTUM_ZOOM_SCRIPT}    };
    return { graphElement, loadGoalGraph, updateGraphVisibility, readMomentumState,
      restoreMomentumState, rememberMomentumGoal, scheduleGoalGraphLayout, restoreGoalGraphViewport,
      handleMomentumNavigationClick, handleMomentumSelectionClick, handleMomentumZoomClick };
  }`;
