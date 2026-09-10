import { GOALS_DIALOGS_CLIENT_FACTORY_SCRIPT, GOALS_LIFECYCLE_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_DRAFT_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_MOMENTUM_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_RELATION_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
import { GOALS_SAFETY_CLIENT_FACTORY_SCRIPT, GOALS_IMPACT_CLIENT_FACTORY_SCRIPT, GOALS_POLICY_CLIENT_FACTORY_SCRIPT } from "@adeptify/goalboard-plugin-goals";
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
    const splitLines = (value) => [...new Set(String(value || "")
      .split("\\n")
      .map((item) => item.trim())
      .filter(Boolean))];

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

    const riskStateEffect = (blockingMode, riskState) => {
      if (!riskState) return L("选择处理结果后，这里会说明会发生什么。");
      const active = riskState === "open" || riskState === "triggered";
      if (!active) {
        return blockingMode === "invalidate_on_trigger"
          ? L("当前不再使 Goal 失效；若此前触发，关联 Goal 必须重新验证。")
          : L("当前状态不再施加领取或完成门禁。");
      }
      if (blockingMode === "claim") return L("当前会阻止所有关联 Goal 被新的 Runtime 领取。");
      if (blockingMode === "completion") return L("当前会阻止所有关联 Goal 被标记为完成。");
      if (blockingMode === "invalidate_on_trigger") {
        return riskState === "triggered"
          ? L("Risk 已触发，所有关联 Goal 立即失效。")
          : L("Risk 目前开放；一旦标记为已触发，所有关联 Goal 会失效。");
      }
      return L("这是一条持续观察的事实，不直接阻塞领取或完成。");
    };

    const updateRiskStatePreview = (riskForm) => {
      const preview = riskForm?.querySelector("[data-risk-state-preview]");
      const stateSelect = riskForm?.querySelector("[data-risk-state-select]");
      if (preview && stateSelect) {
        const effect = riskStateEffect(riskForm.dataset.riskBlocking, stateSelect.value);
        preview.textContent = stateSelect.value === "open" || stateSelect.value === "triggered"
          ? L("保存后仍会留在待决定中。{effect}", { effect })
          : effect;
      }
      const basis = riskForm?.querySelector("[data-risk-resolution-basis]");
      if (basis && stateSelect) basis.hidden = stateSelect.value !== "resolved";
    };

    const showToast = (message, error = false) => {
      toast.textContent = message;
      toast.classList.toggle("is-error", error);
      toast.classList.add("is-visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
    };

    const { handleGoalDraftSubmit, handleGoalDraftOpen, handleGoalDraftCriteriaClick } =
      (${GOALS_DRAFT_CLIENT_FACTORY_SCRIPT})({
        route, controlHeaders: goalboardControlHeaders, splitLines,
        refreshBoard: (...args) => refreshBoard(...args), showToast, translate: L,
        openEventReader: (...args) => openEventReader(...args),
      });

    const { updateRiskGoalCount, handleRiskPickerChange, handleRiskPickerFilter, handleRiskFactsSubmit } =
      (${GOALS_SAFETY_CLIENT_FACTORY_SCRIPT})({
        splitLines, route, controlHeaders: goalboardControlHeaders, translate: L, requireFormFacts,
        refreshBoard: (...args) => refreshBoard(...args),
        showFactorReceipt: (...args) => showFactorReceipt(...args),
        humanDecisionError: (...args) => humanDecisionError(...args),
      });
    const { handleGoalImpactSubmit } = (${GOALS_IMPACT_CLIENT_FACTORY_SCRIPT})({
      route, controlHeaders: goalboardControlHeaders, translate: L, requireFormFacts,
      requireDecisionText: (...args) => requireDecisionText(...args),
      refreshBoard: (...args) => refreshBoard(...args),
      showFactorReceipt: (...args) => showFactorReceipt(...args),
      humanDecisionError: (...args) => humanDecisionError(...args),
    });
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
        currentLocale: () => document.documentElement.lang,
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
