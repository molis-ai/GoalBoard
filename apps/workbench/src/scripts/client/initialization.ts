/** AP3 Workbench client segment: initialization. */
export const CLIENT_INITIALIZATION_SCRIPT = `      const reviewForm = submittedForm.closest?.("[data-human-review-form]");
      if (reviewForm) {
        event.preventDefault();
        const submit = reviewForm.querySelector('button[type="submit"]');
        const errorBox = reviewForm.querySelector("[data-review-error]");
        const values = new FormData(reviewForm);
        if (requireDecisionText(reviewForm, errorBox, "verdict", "请先选择结论。")) return;
        if (requireDecisionText(reviewForm, errorBox, "reasoning", "请填写判断理由。说明结果为什么达到或没有达到完成标准。")) return;
        const extraRefs = String(values.get("evidence_refs_extra") || "")
          .split("\\n")
          .map((item) => item.trim())
          .filter(Boolean);
        const evidenceRefs = [...new Set([...values.getAll("evidence_refs").map(String), ...extraRefs])];
        const receiptContext = decisionReceiptContext(reviewForm);
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(
            route("/api/goals/" + encodeURIComponent(reviewForm.dataset.goalId) +
              "/review-obligations/" + encodeURIComponent(reviewForm.dataset.obligationId) +
              "/review"),
            {
              method: "POST",
              headers: goalboardControlHeaders(),
              body: JSON.stringify({
                verdict: values.get("verdict"),
                evidence_refs: evidenceRefs,
                reasoning: String(values.get("reasoning") || "").trim(),
                attention_token: reviewForm.dataset.attentionToken,
                contract_revision: Number(reviewForm.dataset.contractRevision),
              }),
            },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "结果确认保存失败");
          const resultMessages = {
            pass: L("结果已确认通过；Goal 是否完成仍由全部完成条件共同决定。"),
            needs_changes: L("结果已退回修改；你的理由和依据已保留。"),
            fail: L("结果已确认未通过；你的理由和依据已保留。"),
            inconclusive: L("结果暂未判断；请补充与完成标准对应的依据。"),
          };
          const nextAction = result?.transition?.projection?.primary_action;
          const receiptMessage = (resultMessages[result?.review?.verdict] || L("结果确认已记录。")) +
            (nextAction ? L(" 下一步：{action}。", { action: result.transition.summary || nextAction.kind }) : "");
          await refreshBoardWithDecisionReceipt(receiptMessage, receiptContext);
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, "结果确认保存失败，请检查输入后重试");
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
      }
    });

    bindGoalCreateEvents();
    addEventListener("popstate", handleGoalPopState);
    addEventListener("hashchange", handleGoalHashChange);
    addEventListener("pagehide", saveUiState);
    addEventListener("keydown", (event) => {
      if (handleGoalWorkTabKeyboard(event)) return;
      if (handleGoalPanelKeyboard(event)) return;
      const currentFocusSection = event.target?.closest?.("[data-focus-section-trigger]:not([data-goal-factor-tab])");
      if (currentFocusSection && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        const triggers = [...currentFocusSection.closest("[data-focus-section-deck]").querySelectorAll("[data-focus-section-card-row] > [data-focus-section-card] > [data-focus-section-trigger]")];
        const currentIndex = triggers.indexOf(currentFocusSection);
        const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = event.key === "Home"
          ? 0
          : event.key === "End"
            ? triggers.length - 1
            : (currentIndex + direction + triggers.length) % triggers.length;
        event.preventDefault();
        const nextTrigger = triggers[nextIndex];
        activateFocusSection(nextTrigger);
        nextTrigger.focus();
        return;
      }
      if (handleGoalFactorKeyboard(event)) return;
      if (handleTreeKeyboard(event)) return;
      if (event.key === "Escape" && !feedFilterPanel?.hidden) {
        event.preventDefault();
        setFeedFilterOpen(false);
        feedFilterTrigger?.focus();
        return;
      }
      const quickDialog = document.querySelector("[data-quick-record-dialog][open]");
      if (event.key === "Escape" && quickDialog) {
        event.preventDefault();
        quickDialog.close();
        resetQuickRecordDialog(quickDialog);
        quickDialog._opener?.focus();
        return;
      }
      handleGoalDialogEscape(event);
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshBoard();
    });
    addEventListener("resize", () => {
      const nextCompanionActive = document.body.dataset.desktopShell === "true" && matchMedia("(max-width: 760px)").matches;
      if (nextCompanionActive && !desktopCompanionActive && selected) setMobileView("document");
      desktopCompanionActive = nextCompanionActive;
      setTreeWidth(treePane.getBoundingClientRect().width, false);
      scheduleGoalGraphLayout();
    });

    setTreeWidth(treePane.getBoundingClientRect().width, false);
    if (tuiPane) setTuiWidth(tuiPane.getBoundingClientRect().width, false);
    let restoredUi = false;
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(storageKey) ||
        (!decisionView && !collectionView ? sessionStorage.getItem(goalUiStorageKey) : null) ||
        "null",
      );
      if (stored) {
        applyUiState(stored);
        restoredUi = true;
        sessionStorage.setItem(storageKey, JSON.stringify(stored));
      }
    } catch {}
    if (!restoredUi) {
      setWorkspaceMode("focus", false);
      setGoalPanel(goalPanelFromHash() || "overview", false);
      if (feedDirectory) setFeedPreset("inbox_message", false);
      if (desktopDirectoryPanels.length) {
        setDesktopDirectory(decisionView ? "feed" : treePane?.dataset.desktopDirectory || "root", false, false);
      }
      if (desktopWorkSurfaces.length) setDesktopWorkSurface(decisionView ? "feed" : "goal", false, false);
    }
    const directGoalRequested = /^\\/(?:archive\\/|trash\\/)?goals\\/[^\\/]+\\/?$/.test(localPathname());
    if (directGoalRequested && selected) {
      goalWorkspaceMode = "focus";
      setDesktopDirectory("goals", false, false);
      if (desktopWorkSurfaces.length) setDesktopWorkSurface("goal", false, false);
      setWorkspaceMode("focus", false);
      if (matchMedia("(max-width: 760px)").matches) setMobileView("document");
      saveUiState();
    }
    const feedStartRequested = new URLSearchParams(location.search).get("feed-start") === "1";
    const onboardingRuntimeRequested = new URLSearchParams(location.search).get("onboarding-runtime") === "1";
    if (onboardingRuntimeRequested && selected && tuiPane) {
      goalWorkspaceMode = "runtime";
      setDesktopDirectory("goals", false, false);
      if (desktopWorkSurfaces.length) setDesktopWorkSurface("goal", false, false);
      setWorkspaceMode("runtime", false);
      setMobileView("tui");
      saveUiState();
    }
    if (feedStartRequested && selected && tuiPane) {
      goalWorkspaceMode = "runtime";
      setDesktopDirectory("goals", false, false);
      if (desktopWorkSurfaces.length) setDesktopWorkSurface("goal", false, false);
      setWorkspaceMode("runtime", false);
      setMobileView("tui");
      saveUiState();
    }
    const initialHashTargetId = decodeURIComponent(location.hash.slice(1));
    if (!restoredUi && initialHashTargetId) void revealDeepLinkFromId(initialHashTargetId);
    try {
      const goalMoveReceipt = JSON.parse(sessionStorage.getItem(goalMoveReceiptKey) || "null");
      sessionStorage.removeItem(goalMoveReceiptKey);
      if (goalMoveReceipt?.message) showToast(goalMoveReceipt.message);
    } catch {
      sessionStorage.removeItem(goalMoveReceiptKey);
    }
    try {
      const storedDecisionReceipt = JSON.parse(sessionStorage.getItem("goalboard-decision-receipt") || "null");
      sessionStorage.removeItem("goalboard-decision-receipt");
      if (storedDecisionReceipt?.message) {
        showDecisionReceipt(storedDecisionReceipt.message, storedDecisionReceipt.context);
      }
    } catch {
      sessionStorage.removeItem("goalboard-decision-receipt");
    }
    if (selected && tuiPane) {
      tuiPane.setAttribute("data-goal-id", selected);
      const selectedItem = visibleGoals().find((entry) => entry.goal.goal_id === selected);
      document.dispatchEvent(new CustomEvent("goalboard:goal-changed", { detail: {
        goalId: selected,
        goalTitle: selectedItem?.goal.title || selected,
        status: selectedItem?.status || "",
        statusLabel: selectedItem?.status_label || "",
        statusMeaning: selectedItem?.status_meaning || "",
        statusIconMarkup: selectedItem?.status_icon || "",
        parentReadOnly: Boolean(selectedItem?.is_compound_parent),
        children: selectedItem?.children || [],
      } }));
    }
    if (selected) ensureWorkTab(selected);
    else renderWorkTabs();
    updateRelationPreviews();
    updateAllRelationFormPreviews();
    setInterval(refreshBoard, 4000);
  })();
`;
