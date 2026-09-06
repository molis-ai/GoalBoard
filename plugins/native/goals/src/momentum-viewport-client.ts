/** Existing topology geometry and pointer behavior; consumed inside the shared browser startup scope. */
const GOALS_MOMENTUM_VIEWPORT_SCRIPT = `    const drawGoalGraph = () => {
      const graph = graphElement();
      const stage = graph?.querySelector("[data-graph-stage]");
      if (!graph || graph.hidden || !stage) return;
      const scale = Number(stage.dataset.graphScale || "1") || 1;
      const stageRect = stage.getBoundingClientRect();
      const nodeById = new Map(
        [...stage.querySelectorAll("[data-graph-node]")]
          .filter((node) => !node.hidden)
          .map((node) => [node.dataset.goalId, node]),
      );
      [...stage.querySelectorAll("[data-graph-edge]")].filter((edge) => !edge.hasAttribute("hidden")).forEach((edge, visibleEdgeIndex) => {
        const from = nodeById.get(edge.dataset.edgeFrom);
        const to = nodeById.get(edge.dataset.edgeTo);
        const path = edge.querySelector("path");
        if (!from || !to || !path) return;
        const fromRect = from.getBoundingClientRect();
        const toRect = to.getBoundingClientRect();
        const fromX = (fromRect.right - stageRect.left) / scale;
        const fromY = (fromRect.top + fromRect.height / 2 - stageRect.top) / scale;
        const toX = (toRect.left - stageRect.left) / scale;
        const toY = (toRect.top + toRect.height / 2 - stageRect.top) / scale;
        const edgeIndex = Number(edge.dataset.edgeIndex || visibleEdgeIndex) || 0;
        if (toX > fromX + 16) {
          const middleX = fromX + (toX - fromX) * .5 + ((edgeIndex % 3) - 1) * 5;
          path.setAttribute("d", "M " + fromX + " " + fromY + " H " + middleX + " V " + toY + " H " + toX);
        } else {
          const routeY = Math.min(fromY, toY) - 24 - edgeIndex % 4 * 7;
          path.setAttribute("d", "M " + fromX + " " + fromY + " H " + (fromX + 16) + " V " + routeY + " H " + (toX - 16) + " V " + toY + " H " + toX);
        }
      });
    };

    const bindGoalGraphViewport = () => {
      const viewport = graphElement()?.querySelector("[data-graph-viewport]");
      if (!viewport) return;
      if (typeof ResizeObserver === "function" && graphResizeTarget !== viewport) {
        graphResizeObserver?.disconnect();
        graphResizeTarget = viewport;
        graphResizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(graphResizeFrame);
          graphResizeFrame = requestAnimationFrame(() => isAutoFit() ? fitGoalGraph(false) : drawGoalGraph());
        });
        graphResizeObserver.observe(viewport);
      }
      if (viewport.dataset.panBound === "true") return;
      viewport.dataset.panBound = "true";
      let pointerId = null;
      let pointerX = 0;
      let pointerY = 0;
      let scrollLeft = 0;
      let scrollTop = 0;
      viewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest("button, a, input, select, textarea")) return;
        pointerId = event.pointerId;
        pointerX = event.clientX;
        pointerY = event.clientY;
        scrollLeft = viewport.scrollLeft;
        scrollTop = viewport.scrollTop;
        viewport.classList.add("is-panning");
        viewport.setPointerCapture(pointerId);
        event.preventDefault();
      });
      viewport.addEventListener("pointermove", (event) => {
        if (pointerId !== event.pointerId || !viewport.hasPointerCapture(pointerId)) return;
        viewport.scrollLeft = scrollLeft - (event.clientX - pointerX);
        viewport.scrollTop = scrollTop - (event.clientY - pointerY);
      });
      const finishPan = (event) => {
        if (pointerId !== event.pointerId) return;
        if (viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
        pointerId = null;
        viewport.classList.remove("is-panning");
      };
      viewport.addEventListener("pointerup", finishPan);
      viewport.addEventListener("pointercancel", finishPan);
    };

`;

/** Internal viewport binding: geometry, observation and pointer lifetime belong together. */
export const GOALS_MOMENTUM_VIEWPORT_FACTORY_SCRIPT = `(host) => {
    const { graphElement, isAutoFit, fitGoalGraph } = host;
    let graphResizeObserver = null;
    let graphResizeTarget = null;
    let graphResizeFrame = 0;
${GOALS_MOMENTUM_VIEWPORT_SCRIPT}
    return { drawGoalGraph, bindGoalGraphViewport };
  }`;
