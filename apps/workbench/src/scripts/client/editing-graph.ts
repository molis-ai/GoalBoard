import { GOALS_DIALOGS_CLIENT_FACTORY_SCRIPT, GOALS_LIFECYCLE_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_MOMENTUM_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_RELATION_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_POLICY_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
/** AP3 Workbench client segment: editing-graph. */
export const CLIENT_EDITING_GRAPH_SCRIPT = `
    const { updateRelationPreviews, updateAllRelationFormPreviews, handleGoalRelationChange,
      handleGoalRelationDisclosureClick, handleGoalRelationSubmit } = (${GOALS_RELATION_CLIENT_FACTORY_SCRIPT})({
        form, currentLocale: () => document.documentElement.lang, route, controlHeaders: goalboardControlHeaders, translate: L,
        refreshBoard: (...args) => refreshBoard(...args),
        requireFormFacts: (...args) => requireFormFacts(...args),
        requireDecisionText: (...args) => requireDecisionText(...args),
        showFactorReceipt: (...args) => showFactorReceipt(...args),
        humanDecisionError: (...args) => humanDecisionError(...args),
      });
    const requireFormFacts = (form, errorBox) => {
      const invalid = [...form.querySelectorAll("[required]")].find((control) => {
        if (control.type === "checkbox" || control.type === "radio") return !control.checked;
        return !String(control.value || "").trim();
      });
      if (!invalid) return false;
      let disclosure = invalid.closest("details");
      while (disclosure) {
        disclosure.open = true;
        disclosure = disclosure.parentElement?.closest("details");
      }
      form.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute("aria-invalid"));
      invalid.setAttribute("aria-invalid", "true");
      const label = invalid.closest("label")?.querySelector(":scope > span")?.textContent?.trim() || L("必填信息");
      errorBox.textContent = L("请先补充：{label}", { label });
      errorBox.hidden = false;
      requestAnimationFrame(() => invalid.focus());
      return true;
    };

    const showToast = (message, error = false) => {
      toast.textContent = message;
      toast.classList.toggle("is-error", error);
      toast.classList.add("is-visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
    };

    const { handleGoalPolicySubmit } = (${GOALS_POLICY_CLIENT_FACTORY_SCRIPT})({
      route, controlHeaders: goalboardControlHeaders, translate: L, requireFormFacts, showToast,
      refreshBoard: (...args) => refreshBoard(...args),
      showFactorReceipt: (...args) => showFactorReceipt(...args),
      humanDecisionError: (...args) => humanDecisionError(...args),
    });

    const goalPageBase = () => route(trashView ? "/trash/goals/" : archiveView ? "/archive/goals/" : "/goals/");
    const goalPageUrl = (goalId) => goalPageBase() + encodeURIComponent(goalId) + (document.body.dataset.nativeDesktop === "true" ? "?desktop=1" : "");

    const { readCreateDraft, refreshCreateChoices, handleGoalDialogClick, handleGoalTrashSubmit,
      bindGoalCreateEvents, handleGoalDialogEscape } = (${GOALS_DIALOGS_CLIENT_FACTORY_SCRIPT})({
        dialog, form, route, controlHeaders: goalboardControlHeaders,
        refreshBoard: (...args) => refreshBoard(...args), updateRelationPreviews,
        currentLocale: () => document.documentElement.lang, translate: L,
        clearCollectionUiState: () => sessionStorage.removeItem(storageKey),
        clearCurrentGoalUiState: () => sessionStorage.removeItem(currentGoalUiStorageKey),
        navigate: (url) => location.assign(globalThis.goalboardNavigationUrl(url)),
      });
    const { handleGoalLifecycleClick } = (${GOALS_LIFECYCLE_CLIENT_FACTORY_SCRIPT})({
      route, controlHeaders: goalboardControlHeaders, refreshBoard: (...args) => refreshBoard(...args),
      showToast, navigate: (url) => location.assign(globalThis.goalboardNavigationUrl(url)),
    });
    const applyMobilePanePresence = () => {
      const graph = workspace.querySelector("[data-goal-momentum]");
      const narrow = matchMedia("(max-width: 760px)").matches;
      const view = workspace.dataset.mobileView || "tree";
      const mode = workspace.dataset.workspaceMode;
      const visiblePane = !narrow
        ? null
        : mode === "graph" && view !== "tree"
          ? graph
          : view === "tui"
            ? tuiPane
            : view === "document"
              ? documentPane
              : treePane;
      const panes = [treePane, documentPane, tuiPane, graph].filter(Boolean);
      const active = document.activeElement;
      const shouldMoveFocus = Boolean(active && narrow && visiblePane && panes.some((pane) => pane !== visiblePane && pane.contains(active)));
      panes.forEach((pane) => {
        if (!narrow) {
          pane.removeAttribute("inert");
          return;
        }
        pane.toggleAttribute("inert", pane !== visiblePane);
      });
      if (!shouldMoveFocus || !visiblePane) return;
      const switchRoot = document.querySelector(".mobile-switch");
      const selectedTab = switchRoot?.querySelector("[aria-selected='true']");
      if (selectedTab instanceof HTMLElement) selectedTab.focus();
      else if (visiblePane instanceof HTMLElement) visiblePane.focus({ preventScroll: true });
    };

    const setMobileView = (view) => {
      workspace.dataset.mobileView = view;
      document.querySelector(".topbar")?.setAttribute("data-mobile-surface", view);
      syncMobileNavigationChrome();
      applyMobilePanePresence();
    };

    const handleMobileSwitchKeyboard = (event) => {
      const switchRoot = event.target?.closest?.(".mobile-switch");
      if (!switchRoot || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return false;
      const tabs = [...switchRoot.querySelectorAll("[role='tab']")];
      const current = event.target?.closest?.("[role='tab']");
      const index = tabs.indexOf(current);
      if (index < 0) return false;
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + ((event.key === "ArrowRight" || event.key === "ArrowDown") ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      const next = tabs[nextIndex];
      next?.focus();
      next?.click();
      return true;
    };

    const { graphElement, loadGoalGraph, updateGraphVisibility, readMomentumState,
      restoreMomentumState, rememberMomentumGoal, scheduleGoalGraphLayout, restoreGoalGraphViewport,
      handleMomentumNavigationClick, handleMomentumSelectionClick, handleMomentumZoomClick } =
      (${GOALS_MOMENTUM_CLIENT_FACTORY_SCRIPT})({
        workspace, treeSearch, documentCollection, route, translate: L,
        getSelected: () => selected, getSelectedStatuses: () => getSelectedStatuses(),
        queueSave: () => queueSave(), setWorkspaceMode: (...args) => setWorkspaceMode(...args),
        setNavigatorView: (...args) => setNavigatorView(...args),
      });
    const setWorkspaceMode = (view, persist = true) => {
      const graph = graphElement();
      const nextMode = view === "graph" && graph
        ? "graph"
        : view === "runtime" && tuiPane
          ? "runtime"
          : "focus";
      navigatorView = nextMode === "graph" ? "graph" : "list";
      treePane.dataset.navigatorView = navigatorView;
      workspace.dataset.navigatorView = navigatorView;
      workspace.dataset.workspaceMode = nextMode;
      workspace.classList.toggle("is-graph-view", nextMode === "graph");
      documentPane.hidden = nextMode !== "focus";
      if (tuiPane) tuiPane.hidden = nextMode !== "runtime";
      document.querySelectorAll("button[data-navigator-view]").forEach((button) => {
        const active = button.dataset.navigatorView === navigatorView;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      document.querySelectorAll("button[data-workbench-view]").forEach((button) => {
        const active = button.dataset.workbenchView === nextMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        button.setAttribute("tabindex", active ? "0" : "-1");
      });
      if (graph) graph.hidden = nextMode !== "graph";
      if (nextMode === "graph") {
        if (graph?.dataset.loaded === "true") updateGraphVisibility();
        else void loadGoalGraph();
      }
      if (matchMedia("(max-width: 760px)").matches) setMobileView(nextMode === "runtime" ? "tui" : "document");
      else applyMobilePanePresence();
      if (persist) queueSave();
    };

    const setNavigatorView = (view, persist = true) => {
      setWorkspaceMode(view === "graph" ? "graph" : "focus", persist);
    };

`;
