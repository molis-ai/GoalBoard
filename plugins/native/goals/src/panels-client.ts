/** Existing Goal presentation loading; shared Host dependencies remain explicitly composed. */
const GOALS_PANEL_HASH_SCRIPT = `    const goalPanelFromTargetId = (targetId) => {
      if (!targetId) return "";
      const target = document.getElementById(targetId);
      const renderedPanel = target?.closest?.("[data-goal-panel]")?.dataset.goalPanel;
      if (renderedPanel) return renderedPanel;
      const panelTarget = targetId.match(/^goal-panel-(overview|completion|progress|factors|records)-/);
      if (panelTarget) return panelTarget[1];
      if (targetId.startsWith("completion-") || targetId.startsWith("acceptance-")) return "completion";
      if (targetId.startsWith("progress-")) return "progress";
      if (/^(?:goal-factor-panel|relation|risk|impact)-/.test(targetId)) return "factors";
      return "";
    };

    const goalPanelFromHash = () => {
      const targetId = decodeURIComponent(location.hash.slice(1));
      return goalPanelFromTargetId(targetId);
    };

    const goalFactorFromTargetId = (targetId) => {
      if (!targetId) return "";
      const target = document.getElementById(targetId);
      const renderedFactor = target?.closest?.("[data-goal-factor-panel]")?.dataset.goalFactorPanel;
      if (renderedFactor) return renderedFactor;
      const factorTarget = targetId.match(/^goal-factor-panel-(relations|risks|impacts|rules)-/);
      if (factorTarget) return factorTarget[1];
      if (targetId.startsWith("relation-")) return "relations";
      if (targetId.startsWith("risk-")) return "risks";
      if (targetId.startsWith("impact-")) return "impacts";
      return "";
    };

    const goalFactorFromHash = () => {
      const targetId = decodeURIComponent(location.hash.slice(1));
      return goalFactorFromTargetId(targetId);
    };

`;

const GOALS_PANEL_CLICK_SCRIPT = `    const handleGoalPanelClick = (target) => {
      const goalTab = target.closest("[data-goal-tab]");
      if (goalTab) {
        setGoalPanel(goalTab.dataset.goalTab, true, true, true);
        return true;
      }
      const retryGoalPanel = target.closest("[data-retry-goal-panel]");
      if (retryGoalPanel) {
        const article = retryGoalPanel.closest("[data-goal-view]");
        void loadGoalPanel(article, retryGoalPanel.dataset.retryGoalPanel);
        return true;
      }
      return false;
    };
`;

const GOALS_FACTOR_CLICK_SCRIPT = `    const handleGoalFactorClick = (target) => {
      const factorTab = target.closest("[data-goal-factor-tab]");
      if (factorTab) {
        setGoalFactor(factorTab.dataset.goalFactorTab, true, true);
        return true;
      }
      return false;
    };
`;

const GOALS_PANEL_KEYBOARD_SCRIPT = `    const handleGoalPanelKeyboard = (event) => {
      const currentTab = event.target?.closest?.("[data-goal-tab]");
      if (currentTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = [...currentTab.closest('[role="tablist"]').querySelectorAll("[data-goal-tab]")];
        const currentIndex = tabs.indexOf(currentTab);
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        setGoalPanel(nextTab.dataset.goalTab, true, true, true);
        nextTab.focus();
        return true;
      }
      return false;
    };
`;

const GOALS_FACTOR_KEYBOARD_SCRIPT = `    const handleGoalFactorKeyboard = (event) => {
      const currentFactorTab = event.target?.closest?.("[data-goal-factor-tab]");
      if (currentFactorTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = [...currentFactorTab.closest('[role="tablist"]').querySelectorAll("[data-goal-factor-tab]")];
        const currentIndex = tabs.indexOf(currentFactorTab);
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        setGoalFactor(nextTab.dataset.goalFactorTab, true, true);
        nextTab.focus();
        return true;
      }
      return false;
    };
`;

const GOALS_PANEL_LOAD_SCRIPT = `    const clearGoalPanelRequest = (controller) => {
      if (goalPanelRequest !== controller) return;
      loadingPanel.dataset.loading = "false";
      loadingPanel.removeAttribute("aria-busy");
      loadingPanel = null;
      goalPanelRequest = null;
    };

    const abortGoalPanelRequest = () => {
      const controller = goalPanelRequest;
      if (!controller) return;
      controller.abort();
      clearGoalPanelRequest(controller);
    };

    const loadGoalPanel = async (article, panelName) => {
      const panel = article?.querySelector('[data-goal-panel="' + panelName + '"]');
      if (!panel || panel.dataset.loaded === "true" || panel.dataset.loading === "true") return;
      const goalId = article.dataset.goalView;
      if (!goalId || !["completion", "progress", "factors"].includes(panelName)) return;
      abortGoalPanelRequest();
      const controller = new AbortController();
      goalPanelRequest = controller;
      loadingPanel = panel;
      panel.dataset.loading = "true";
      panel.setAttribute("aria-busy", "true");
      const status = panel.querySelector("[data-goal-panel-status]");
      if (status) status.textContent = L("正在载入…");
      try {
        const response = await fetch(
          route("/api/goals/" + encodeURIComponent(goalId) + "/panels/" + panelName + "?view=" + documentCollection),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(L("无法读取这个 Goal 区域"));
        const template = document.createElement("template");
        template.innerHTML = (await response.text()).trim();
        if (!template.content.childNodes.length) throw new Error(L("Goal 区域响应不完整"));
        if (!article.isConnected || article.dataset.goalView !== goalId || goalPanelRequest !== controller) return;
        panel.replaceChildren(...template.content.childNodes);
        panel.dataset.loaded = "true";
        afterReplace();
        if (panelName === "factors") {
          setGoalFactor(goalFactorFromHash() || article.dataset.activeFactor || "relations", false);
        }
        const hashTarget = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (hashTarget) revealFocusTarget(hashTarget);
      } catch (error) {
        if (isAbortError(error) || goalPanelRequest !== controller) return;
        if (!article.isConnected || article.dataset.goalView !== goalId) return;
        const message = error instanceof Error ? error.message : L("无法载入这个 Goal 区域");
        const errorRow = document.createElement("button");
        errorRow.type = "button";
        errorRow.className = "empty-row goal-panel-lazy-retry";
        errorRow.dataset.retryGoalPanel = panelName;
        errorRow.textContent = L("{message}，点击重试", { message });
        panel.replaceChildren(errorRow);
        showError(message);
      } finally {
        clearGoalPanelRequest(controller);
      }
    };

`;

const GOALS_PANEL_SELECT_SCRIPT = `    const setGoalPanel = async (panelName, persist = true, updateHash = false, resetScroll = false) => {
      const article = documentPane.querySelector("[data-goal-view]");
      if (!article) return false;
      const panel = goalPanelKeys.includes(panelName) ? panelName : "overview";
      const activePanel = article.querySelector('[data-goal-panel="' + panel + '"]');
      if (!activePanel) return false;
      article.dataset.activePanel = panel;
      article.querySelectorAll("[data-goal-tab]").forEach((button) => {
        const active = button.dataset.goalTab === panel;
        button.setAttribute("aria-selected", String(active));
        button.setAttribute("tabindex", active ? "0" : "-1");
      });
      article.querySelectorAll("[data-goal-panel]").forEach((candidate) => {
        candidate.hidden = candidate !== activePanel;
      });
      let loading;
      if (panel === "records") loading = loadGoalRecords(article);
      else {
        abortGoalRecordsRequest();
        if (panel !== "overview") loading = loadGoalPanel(article, panel);
      }
      if (updateHash) history.replaceState(history.state, "", "#" + activePanel.id);
      if (resetScroll) documentPane.scrollTop = 0;
      if (persist) queueSave();
      await loading;
      return article.isConnected && article.dataset.activePanel === panel;
    };

    const setGoalFactor = (factorName, persist = true, updateHash = false) => {
      const article = documentPane.querySelector("[data-goal-view]");
      if (!article) return false;
      const factor = goalFactorKeys.includes(factorName) ? factorName : "relations";
      const activePanel = article.querySelector('[data-goal-factor-panel="' + factor + '"]');
      if (!activePanel) {
        article.dataset.activeFactor = factor;
        return false;
      }
      const trigger = article.querySelector('[data-goal-factor-tab="' + factor + '"]');
      if (trigger) activateFocusSection(trigger);
      article.dataset.activeFactor = factor;
      article.querySelectorAll("[data-goal-factor-tab]").forEach((button) => {
        const active = button.dataset.goalFactorTab === factor;
        button.setAttribute("aria-selected", String(active));
        button.setAttribute("tabindex", active ? "0" : "-1");
      });
      if (updateHash) history.replaceState(history.state, "", "#" + activePanel.id);
      if (persist) queueSave();
      return true;
    };

`;

/** Explicit Host ports; all panel/factor request and navigation state belongs to this instance. */
export const GOALS_PANELS_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { documentPane, documentCollection, route, translate: L, isAbortError,
      showError, afterReplace, revealFocusTarget, activateFocusSection,
      queueSave, loadGoalRecords, abortGoalRecordsRequest } = host;
    const goalPanelKeys = ["overview", "completion", "progress", "factors", "records"];
    const goalFactorKeys = ["relations", "risks", "impacts", "rules"];
    let goalPanelRequest = null;
    let loadingPanel = null;
${GOALS_PANEL_HASH_SCRIPT}${GOALS_PANEL_LOAD_SCRIPT}${GOALS_PANEL_SELECT_SCRIPT}${GOALS_PANEL_CLICK_SCRIPT}${GOALS_FACTOR_CLICK_SCRIPT}${GOALS_PANEL_KEYBOARD_SCRIPT}${GOALS_FACTOR_KEYBOARD_SCRIPT}
    return { abortGoalPanelRequest, loadGoalPanel, setGoalPanel, setGoalFactor,
      goalPanelFromTargetId, goalPanelFromHash, goalFactorFromTargetId, goalFactorFromHash,
      handleGoalPanelClick, handleGoalFactorClick, handleGoalPanelKeyboard, handleGoalFactorKeyboard };
  }`;
