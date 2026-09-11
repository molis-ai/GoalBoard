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
    const setMobileView = (view) => {
      workspace.dataset.mobileView = view;
      document.querySelector(".topbar")?.setAttribute("data-mobile-surface", view);
      const directoryRootActive = view === "tree" && treePane?.dataset.desktopDirectory === "root";
      if (mobileDirectoryTab) {
        mobileDirectoryTab.classList.toggle("is-active", directoryRootActive);
        mobileDirectoryTab.setAttribute("aria-selected", String(directoryRootActive));
      }
      document.querySelectorAll("[data-mobile-target]").forEach((button) => {
        const active = button.dataset.mobileTarget === view && !(directoryRootActive && view === "tree");
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
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
      if (persist) queueSave();
    };

    const setNavigatorView = (view, persist = true) => {
      setWorkspaceMode(view === "graph" ? "graph" : "focus", persist);
    };

`;
