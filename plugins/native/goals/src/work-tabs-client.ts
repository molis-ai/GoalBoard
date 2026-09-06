/** Goal-owned browser behavior, mounted by Workbench at the existing event/initialization position. */
const GOALS_WORK_TABS_RENDER_SCRIPT = `      if (!decisionView && !collectionView) {
        openWorkTabs = openWorkTabs.filter((goalId) => byId.has(goalId));
        if (selected && byId.has(selected) && !openWorkTabs.includes(selected)) openWorkTabs.push(selected);
        openWorkTabs.forEach((goalId, index) => {
          const item = byId.get(goalId);
          if (!item) return;
          const selectedTab = activeDesktopSurface === "goal" && goalId === getSelected();
          const shell = document.createElement("div");
          shell.className = "desktop-work-tab" + (selectedTab ? " is-selected" : "");
          shell.dataset.workTabShell = goalId;
          const tab = document.createElement("button");
          tab.type = "button";
          tab.id = "desktop-work-tab-" + index;
          tab.role = "tab";
          tab.dataset.workTab = goalId;
          tab.setAttribute("aria-selected", String(selectedTab));
          tab.setAttribute("aria-controls", "goal-document-pane");
          tab.tabIndex = selectedTab ? 0 : -1;
          const dot = document.createElement("i");
          dot.dataset.status = item.status;
          dot.setAttribute("aria-hidden", "true");
          const label = document.createElement("span");
          label.textContent = item.goal.title;
          tab.append(dot, label);
          const close = document.createElement("button");
          close.type = "button";
          close.dataset.closeWorkTab = goalId;
          close.setAttribute("aria-label", L("关闭 {title}", { title: item.goal.title }));
          close.textContent = "×";
          shell.append(tab, close);
          fragment.append(shell);
        });
      }
`;

const GOALS_WORK_TABS_STATE_SCRIPT = `    const ensureWorkTab = (goalId) => {
      if (!workTabs || decisionView || collectionView || !goalId) return;
      if (!openWorkTabs.includes(goalId)) openWorkTabs.push(goalId);
      if (openWorkTabs.length > 8) {
        const removable = openWorkTabs.find((candidate) => candidate !== goalId && candidate !== getSelected());
        if (removable) openWorkTabs = openWorkTabs.filter((candidate) => candidate !== removable);
        else openWorkTabs = openWorkTabs.slice(-8);
      }
      renderWorkTabs();
    };

    const focusWorkTab = (goalId) => {
      if (!workTabs || !goalId) return;
      requestAnimationFrame(() => {
        const tab = [...workTabs.querySelectorAll("[data-work-tab]")]
          .find((candidate) => candidate.dataset.workTab === goalId);
        tab?.focus();
      });
    };

`;

const GOALS_WORK_TABS_CLICK_SCRIPT = `      const closeWorkTab = target.closest("[data-close-work-tab]");
      if (closeWorkTab && workTabs && !decisionView && !collectionView) {
        const goalId = closeWorkTab.dataset.closeWorkTab;
        const index = openWorkTabs.indexOf(goalId);
        if (index < 0) return;
        if (openWorkTabs.length === 1) {
          showToast(L("至少保留一个打开的 Goal"));
          return;
        }
        openWorkTabs.splice(index, 1);
        persistWorkTabs();
        if (goalId === getSelected()) {
          const nextGoalId = openWorkTabs[Math.min(index, openWorkTabs.length - 1)];
          if (nextGoalId) {
            await selectGoal(nextGoalId);
            focusWorkTab(nextGoalId);
          }
        } else {
          renderWorkTabs();
          focusWorkTab(getSelected());
        }
        return;
      }
      const workTab = target.closest("[data-work-tab]");
      if (workTab) {
        setDesktopDirectory("goals", true, false, workTab);
        setDesktopWorkSurface("goal", true, true);
        await selectGoal(workTab.dataset.workTab);
        focusWorkTab(getSelected());
        return;
      }
`;

const GOALS_WORK_TABS_KEYBOARD_SCRIPT = `      const currentWorkTab = event.target?.closest?.("[data-work-tab]");
      if (currentWorkTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        const tabs = [...currentWorkTab.closest('[role="tablist"]').querySelectorAll("[data-work-tab]")];
        const currentIndex = tabs.indexOf(currentWorkTab);
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        event.preventDefault();
        const nextTab = tabs[nextIndex];
        const nextGoalId = nextTab.dataset.workTab;
        void selectGoal(nextGoalId).then(() => focusWorkTab(nextGoalId));
        return true;
      }
      return false;
`;

/** Goal tabs own their open list; Workbench owns the shared tablist and utility surfaces. */
export const GOALS_WORK_TABS_CLIENT_FACTORY_SCRIPT = `(host) => {
    const {
      workTabs, decisionView, collectionView, visibleGoals, getSelected, getActiveSurface,
      readStoredTabs, writeStoredTabs, renderWorkTabs, selectGoal,
      setDesktopDirectory, setDesktopWorkSurface, showToast, translate: L,
    } = host;
    let openWorkTabs = [];

    if (workTabs && !decisionView && !collectionView) {
      try {
        const storedTabs = readStoredTabs();
        if (Array.isArray(storedTabs)) openWorkTabs = storedTabs.map(String);
      } catch {}
      const available = new Set(visibleGoals().map((item) => item.goal.goal_id));
      openWorkTabs = openWorkTabs.filter((goalId, index, all) => available.has(goalId) && all.indexOf(goalId) === index);
      if (getSelected() && !openWorkTabs.includes(getSelected())) openWorkTabs.push(getSelected());
    }

    const persistWorkTabs = () => {
      if (!workTabs || decisionView || collectionView) return;
      try { writeStoredTabs(openWorkTabs); } catch {}
    };


    const appendGoalWorkTabs = (fragment, byId) => {
      const selected = getSelected();
      const activeDesktopSurface = getActiveSurface();
${GOALS_WORK_TABS_RENDER_SCRIPT}    };
${GOALS_WORK_TABS_STATE_SCRIPT}
    const handleMatchedWorkTabClick = async (target) => {
${GOALS_WORK_TABS_CLICK_SCRIPT}    };
    const handleGoalWorkTabClick = (target) => {
      if ((target.closest("[data-close-work-tab]") && workTabs && !decisionView && !collectionView) ||
          target.closest("[data-work-tab]")) return handleMatchedWorkTabClick(target);
      return null;
    };
    const handleGoalWorkTabKeyboard = (event) => {
${GOALS_WORK_TABS_KEYBOARD_SCRIPT}    };
    return { appendGoalWorkTabs, persistWorkTabs, ensureWorkTab,
      handleGoalWorkTabClick, handleGoalWorkTabKeyboard };
  }`;
