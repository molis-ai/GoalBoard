/** Existing browser handlers inserted by Workbench into its shared lexical host. */
const GOALS_SAFETY_PAYLOAD_SCRIPT = `    const readRiskPayload = (values) => ({
      goal_ids: values.getAll("goal_ids").map(String),
      description: String(values.get("description") || "").trim(),
      probability: String(values.get("probability") || "").trim(),
      impact: String(values.get("impact") || "").trim(),
      affected_surfaces: splitLines(values.get("affected_surfaces")),
      trigger: String(values.get("trigger") || "").trim(),
      treatment: values.get("treatment"),
      treatment_plan: String(values.get("treatment_plan") || "").trim(),
      blocking_mode: values.get("blocking_mode"),
      revisit_condition: String(values.get("revisit_condition") || "").trim(),
      owner: String(values.get("owner") || "").trim(),
      reason: String(values.get("reason") || "").trim(),
    });

`;

const GOALS_RISK_PICKER_COUNT_SCRIPT = `    const updateRiskGoalCount = (picker) => {
      const count = picker?.querySelectorAll('[name="goal_ids"]:checked').length || 0;
      const summary = picker?.querySelector("summary small");
      if (summary) summary.textContent = count + " 个已选择 · 至少选择一个";
    };

`;

const GOALS_RISK_PICKER_CHANGE_SCRIPT = `      const riskGoalPicker = changed.closest(".risk-goal-picker");
      if (riskGoalPicker) updateRiskGoalCount(riskGoalPicker);
`;

const GOALS_RISK_PICKER_FILTER_SCRIPT = `      const filter = changed.closest?.("[data-risk-goal-filter]");
      if (!filter) return;
      const query = String(filter.value || "").trim().toLocaleLowerCase();
      filter.closest(".risk-goal-picker")?.querySelectorAll("[data-risk-goal-option]").forEach((option) => {
        option.hidden = Boolean(query) && !String(option.dataset.search || "").includes(query);
  `;

const GOALS_RISK_FACTS_SUBMIT_SCRIPT = `      const riskCreateForm = submittedForm.closest?.("[data-risk-create-form]");
      if (riskCreateForm) {
        event.preventDefault();
        const submit = riskCreateForm.querySelector('button[type="submit"]');
        const errorBox = riskCreateForm.querySelector("[data-risk-error]");
        if (requireFormFacts(riskCreateForm, errorBox)) return;
        const values = new FormData(riskCreateForm);
        if (!values.getAll("goal_ids").length) {
          const picker = riskCreateForm.querySelector(".risk-goal-picker");
          if (picker) picker.open = true;
          errorBox.textContent = L("请至少选择一条受影响的 Goal");
          errorBox.hidden = false;
          picker?.querySelector('input[name="goal_ids"]')?.focus();
          return;
        }
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/goals/" + encodeURIComponent(riskCreateForm.dataset.goalId) + "/risks"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify(readRiskPayload(values)),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("风险记录失败"));
          await refreshBoard(true);
          const description = result?.risk?.description || String(values.get("description") || "").trim();
          showFactorReceipt(
            "risks",
            L("风险已记录"),
            L("已记录风险「{description}」。它现在保持待处理；需要确认处理结果时，请到待决定。", { description }),
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, L("风险记录失败，请检查输入后重试"));
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }

      const riskEditForm = submittedForm.closest?.("[data-risk-edit-form]");
      if (riskEditForm) {
        event.preventDefault();
        const submit = riskEditForm.querySelector('button[type="submit"]');
        const errorBox = riskEditForm.querySelector("[data-risk-error]");
        if (requireFormFacts(riskEditForm, errorBox)) return;
        const values = new FormData(riskEditForm);
        if (!values.getAll("goal_ids").length) {
          const picker = riskEditForm.querySelector(".risk-goal-picker");
          if (picker) picker.open = true;
          errorBox.textContent = L("请至少选择一条受影响的 Goal");
          errorBox.hidden = false;
          picker?.querySelector('input[name="goal_ids"]')?.focus();
          return;
        }
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/risks/" + encodeURIComponent(riskEditForm.dataset.riskId) + "/update"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify(readRiskPayload(values)),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("风险更新失败"));
          await refreshBoard(true);
          const description = result?.risk?.description || String(values.get("description") || "").trim();
          showFactorReceipt(
            "risks",
            L("风险信息已更新"),
            L("已更新风险「{description}」。这次修改没有改变它的处理结果。", { description }),
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, L("风险更新失败，请检查输入后重试"));
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }

`;

export const GOALS_SAFETY_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { splitLines, route, controlHeaders: goalboardControlHeaders, translate: L,
      requireFormFacts, refreshBoard, showFactorReceipt, humanDecisionError } = host;
${GOALS_SAFETY_PAYLOAD_SCRIPT}${GOALS_RISK_PICKER_COUNT_SCRIPT}
    const handleRiskPickerChange = (changed) => {
${GOALS_RISK_PICKER_CHANGE_SCRIPT}    };
    const handleRiskPickerFilter = (changed) => {
${GOALS_RISK_PICKER_FILTER_SCRIPT}    });
    };
    const submitMatchedRiskFacts = async (submittedForm, event) => {
${GOALS_RISK_FACTS_SUBMIT_SCRIPT}    };
    const handleRiskFactsSubmit = (submittedForm, event) => submittedForm.closest?.("[data-risk-create-form], [data-risk-edit-form]")
      ? submitMatchedRiskFacts(submittedForm, event) : null;
    return { updateRiskGoalCount, handleRiskPickerChange, handleRiskPickerFilter, handleRiskFactsSubmit };
  }`;
