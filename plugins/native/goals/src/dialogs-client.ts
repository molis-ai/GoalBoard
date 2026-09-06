/** Existing create/trash/restore interactions; host injects controls, navigation and shared refresh. */
const GOALS_TRASH_DIALOG_SCRIPT = `    const openGoalTrashDialog = (trigger, trashed) => {
      if (!trashDialog || !trashForm) return;
      const goalId = String(trigger.dataset.goalId || "").trim();
      const goalTitle = String(trigger.dataset.goalTitle || goalId).trim();
      if (!goalId) return;
      trashIntent = { goalId, goalTitle, trashed };
      trashError.hidden = true;
      trashError.textContent = "";
      trashForm.elements.reason.value = "";
      trashDialog.querySelector("[data-goal-trash-title]").textContent = trashed ? "移入回收站" : "恢复 Goal";
      trashDialog.querySelector("[data-goal-trash-description]").textContent = trashed
        ? "请确认这条 Goal 和本次操作原因。"
        : "请确认把这条 Goal 恢复到日常 Goal Tree。";
      trashDialog.querySelector("[data-goal-trash-target-title]").textContent = goalTitle;
      trashDialog.querySelector("[data-goal-trash-target-id]").textContent = goalId;
      trashDialog.querySelector("[data-goal-trash-note]").textContent = trashed
        ? "该操作可恢复：Goal 历史会保留，当前仍生效的关联关系会暂时停止。若还有有效 Claim 或执行中的 Run，系统不会改动 Goal，而会告诉你先结束哪项工作。"
        : "恢复不会创建新 Goal，也不会自动启动 Runtime。系统只会恢复两端都不在回收站的关联关系；其余关系会保留为待处理事实。";
      trashDialog.querySelector("[data-goal-trash-reason-label]").textContent = trashed ? "移入原因" : "恢复原因";
      trashForm.elements.reason.placeholder = trashed
        ? "说明为什么暂时不再保留这条 Goal"
        : "说明为什么现在要恢复这条 Goal";
      trashSubmit.classList.toggle("button-danger", trashed);
      trashSubmit.classList.toggle("button-primary", !trashed);
      trashSubmit.textContent = trashed ? "移入回收站" : "恢复到 Goal Tree";
      trashDialog.showModal();
      if (!matchMedia("(max-width: 760px)").matches) {
        requestAnimationFrame(() => trashForm.elements.reason.focus());
      }
    };

    const closeGoalTrashDialog = () => {
      if (!trashDialog?.open) return;
      trashDialog.close();
      trashIntent = null;
      refreshBoard();
    };

    const describeTrashBlock = (result) => {
      const claims = Array.isArray(result.blocking_claim_ids) ? result.blocking_claim_ids : [];
      const runs = Array.isArray(result.blocking_run_ids) ? result.blocking_run_ids : [];
      const records = [
        claims.length ? "有效 Claim：" + claims.join(currentLocale() === "en" ? ", " : "、") : "",
        runs.length ? "执行中 Run：" + runs.join(currentLocale() === "en" ? ", " : "、") : "",
      ].filter(Boolean).join("；");
      return "现在无法移入回收站：这条 Goal 仍有正在进行的 Runtime 工作。" +
        (records ? records + "。" : "") +
        "请先结束或释放这些工作，再重新确认。";
    };

    const submitGoalTrashForm = async () => {
      if (!trashIntent || !trashForm || !trashError || !trashSubmit) return;
      const reason = String(new FormData(trashForm).get("reason") || "").trim();
      if (!reason) {
        trashError.textContent = "请说明本次操作原因。";
        trashError.hidden = false;
        trashForm.elements.reason.focus();
        return;
      }
      trashError.hidden = true;
      trashSubmit.disabled = true;
      let redirecting = false;
      try {
        const response = await fetch(route("/api/goals/" + encodeURIComponent(trashIntent.goalId) + "/trash"), {
          method: "POST",
          headers: goalboardControlHeaders(),
          body: JSON.stringify({
            trashed: trashIntent.trashed,
            reason,
            user_confirmed: true,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "操作失败");
        if (result.status === "blocked") {
          trashError.textContent = describeTrashBlock(result);
          trashError.hidden = false;
          return;
        }
        const expected = trashIntent.trashed
          ? ["trashed", "already_trashed"]
          : ["restored", "already_active"];
        if (!expected.includes(result.status)) throw new Error("GoalBoard 返回了无法识别的回收站状态");
        redirecting = true;
        trashDialog.close();
        clearCollectionUiState();
        navigate(route((trashIntent.trashed ? "/trash/goals/" : "/goals/") + encodeURIComponent(trashIntent.goalId)));
      } catch (error) {
        trashError.textContent = error.message || "操作失败，请检查后重试";
        trashError.hidden = false;
      } finally {
        if (!redirecting) trashSubmit.disabled = false;
      }
    };

`;

const GOALS_DIALOG_CLICK_SCRIPT = `      if (target.closest("[data-open-create]")) {
        formError.hidden = true;
        dialog.showModal();
        updateRelationPreviews();
        requestAnimationFrame(() => form.elements.title.focus());
        return true;
      }
      if (target.closest("[data-close-create]")) {
        dialog.close();
        refreshBoard();
        return true;
      }
      const trashAction = target.closest("[data-open-goal-trash]");
      if (trashAction) {
        openGoalTrashDialog(trashAction, true);
        return true;
      }
      const restoreAction = target.closest("[data-open-goal-restore]");
      if (restoreAction) {
        openGoalTrashDialog(restoreAction, false);
        return true;
      }
      if (target.closest("[data-close-goal-trash]")) {
        closeGoalTrashDialog();
        return true;
      }
      return false;
`;

const GOALS_CREATE_SUBMIT_SCRIPT = `    form?.addEventListener("change", updateRelationPreviews);

    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      formError.hidden = true;
      const values = new FormData(form);
      const payload = {
        goal_id: String(values.get("goal_id") || "").trim() || undefined,
        title: String(values.get("title") || "").trim(),
        outcome: String(values.get("outcome") || "").trim(),
        why: String(values.get("why") || "").trim(),
        business_logic: String(values.get("business_logic") || "").trim(),
        priority: Number(values.get("priority") || 0),
        parent_goal_id: String(values.get("parent_goal_id") || "").trim() || undefined,
        dependency_goal_ids: values.getAll("dependency_goal_ids").map(String),
        acceptance_criteria: String(values.get("acceptance_criteria") || "").split("\\n").map((line) => line.trim()).filter(Boolean),
      };
      try {
        const response = await fetch(route("/api/goals"), {
          method: "POST",
          headers: goalboardControlHeaders(),
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "创建失败");
        clearCurrentGoalUiState();
        navigate(result.goal_path);
      } catch (error) {
        formError.textContent = error.message || "创建失败，请检查输入后重试";
        formError.hidden = false;
        submit.disabled = false;
      }
    });

`;

const GOALS_DIALOG_ESCAPE_SCRIPT = `      if (event.key === "Escape" && dialog.open) {
        dialog.close();
        refreshBoard();
      }
      if (event.key === "Escape" && trashDialog?.open) closeGoalTrashDialog();
`;

/** Dialog-local intent and draft state; Host supplies shared refresh, storage and navigation. */
export const GOALS_DIALOGS_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { dialog, form, route, controlHeaders: goalboardControlHeaders, refreshBoard,
      updateRelationPreviews, currentLocale, clearCollectionUiState, clearCurrentGoalUiState, navigate } = host;
    const formError = document.querySelector("[data-create-error]");
    const trashDialog = document.querySelector("[data-goal-trash-dialog]");
    const trashForm = document.querySelector("[data-goal-trash-form]");
    const trashError = document.querySelector("[data-goal-trash-error]");
    const trashSubmit = document.querySelector("[data-goal-trash-submit]");
    let trashIntent = null;
${GOALS_TRASH_DIALOG_SCRIPT}
    const readCreateDraft = () => {
      if (!form) return null;
      const values = {};
      [...form.elements].forEach((control) => {
        if (!control.name) return;
        if (control.type === "checkbox") {
          values[control.name] ||= [];
          if (control.checked) values[control.name].push(control.value);
          return;
        }
        values[control.name] = control.value;
      });
      const active = document.activeElement;
      return {
        values,
        focus: active && form.contains(active) && active.name
          ? { name: active.name, value: active.value, start: active.selectionStart, end: active.selectionEnd }
          : null,
      };
    };

    const applyCreateDraft = (draft) => {
      if (!form || !draft) return;
      [...form.elements].forEach((control) => {
        if (!control.name || !(control.name in draft.values)) return;
        if (control.type === "checkbox") {
          control.checked = draft.values[control.name].includes(control.value);
          return;
        }
        control.value = draft.values[control.name];
      });
      updateRelationPreviews();
      if (!draft.focus) return;
      const focused = [...form.elements].find((control) =>
        control.name === draft.focus.name &&
        (control.type !== "checkbox" || control.value === draft.focus.value)
      );
      if (!focused) return;
      focused.focus({ preventScroll: true });
      if (typeof focused.setSelectionRange === "function" && draft.focus.start != null) {
        focused.setSelectionRange(draft.focus.start, draft.focus.end);
      }
    };


    const refreshCreateChoices = (nextDialog, draft) => {
      form.elements.parent_goal_id.innerHTML = nextDialog.querySelector('[name="parent_goal_id"]').innerHTML;
      form.querySelector(".goal-choice-list").innerHTML = nextDialog.querySelector(".goal-choice-list").innerHTML;
      applyCreateDraft(draft);
    };
    const handleGoalDialogClick = (target) => {
${GOALS_DIALOG_CLICK_SCRIPT}    };
    const handleGoalTrashSubmit = (submittedForm, event) => {
      if (!submittedForm.closest?.("[data-goal-trash-form]")) return null;
      event.preventDefault();
      return submitGoalTrashForm();
    };
    const bindGoalCreateEvents = () => {
${GOALS_CREATE_SUBMIT_SCRIPT}    };
    const handleGoalDialogEscape = (event) => {
${GOALS_DIALOG_ESCAPE_SCRIPT}    };
    return { readCreateDraft, refreshCreateChoices, handleGoalDialogClick, handleGoalTrashSubmit,
      bindGoalCreateEvents, handleGoalDialogEscape };
  }`;
