/** Existing browser handlers inserted by Workbench into its shared lexical host. */
const GOALS_IMPACT_SUBMIT_SCRIPT = `      const impactCreateForm = submittedForm.closest?.("[data-impact-create-form]");
      if (impactCreateForm) {
        event.preventDefault();
        const submit = impactCreateForm.querySelector('button[type="submit"]');
        const errorBox = impactCreateForm.querySelector("[data-impact-error]");
        if (requireFormFacts(impactCreateForm, errorBox)) return;
        const values = new FormData(impactCreateForm);
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/goals/" + encodeURIComponent(impactCreateForm.dataset.goalId) + "/impacts"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify(readImpactPayload(values)),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("影响范围记录失败"));
          await refreshBoard(true);
          const surface = result?.impact?.surface || result?.surface || String(values.get("surface") || "").trim();
          showFactorReceipt(
            "impacts",
            L("影响范围已记录"),
            L("已记录「{surface}」。它已绑定当前 Goal，并按保存的确认状态参与工作冲突判断。", { surface }),
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, L("影响范围记录失败，请检查输入后重试"));
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }

      const impactEditForm = submittedForm.closest?.("[data-impact-edit-form]");
      if (impactEditForm) {
        event.preventDefault();
        const submit = impactEditForm.querySelector('button[type="submit"]');
        const errorBox = impactEditForm.querySelector("[data-impact-error]");
        if (requireFormFacts(impactEditForm, errorBox)) return;
        const values = new FormData(impactEditForm);
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/impacts/" + encodeURIComponent(impactEditForm.dataset.impactId) + "/update"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify(readImpactPayload(values)),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("影响范围更新失败"));
          await refreshBoard(true);
          const surface = result?.impact?.surface || result?.surface || String(values.get("surface") || "").trim();
          showFactorReceipt(
            "impacts",
            L("影响范围已更新"),
            L("已更新「{surface}」。旧值和修改说明已进入完整记录。", { surface }),
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, L("影响范围更新失败，请检查输入后重试"));
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }

      const impactDeactivateForm = submittedForm.closest?.("[data-impact-deactivate-form]");
      if (impactDeactivateForm) {
        event.preventDefault();
        const submit = impactDeactivateForm.querySelector('button[type="submit"]');
        const errorBox = impactDeactivateForm.querySelector("[data-impact-error]");
        if (requireDecisionText(impactDeactivateForm, errorBox, "reason", "请填写停用原因。说明这条影响范围为什么不再有效。")) return;
        const values = new FormData(impactDeactivateForm);
        const surface = impactDeactivateForm.closest(".impact-record")?.querySelector("h4")?.textContent?.trim() || L("这条影响范围");
        submit.disabled = true;
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/impacts/" + encodeURIComponent(impactDeactivateForm.dataset.impactId) + "/deactivate"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({ reason: String(values.get("reason") || "").trim() }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Impact 停用失败");
          await refreshBoard(true);
          showFactorReceipt(
            "impacts",
            L("影响范围已停用"),
            L("「{surface}」不再参与工作冲突判断；原记录和停用原因仍会保留。", { surface }),
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, L("影响范围停用失败，请检查停用原因后重试"));
          errorBox.hidden = false;
          submit.disabled = false;
        }
        return;
      }

`;

export const GOALS_IMPACT_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { route, controlHeaders: goalboardControlHeaders, translate: L,
      requireFormFacts, requireDecisionText, refreshBoard, showFactorReceipt, humanDecisionError } = host;
    const readImpactPayload = (values) => ({
      goal_id: String(values.get("goal_id") || "").trim(),
      surface: String(values.get("surface") || "").trim(),
      access: values.get("access"),
      input_snapshot: String(values.get("input_snapshot") || "").trim(),
      state: values.get("state"),
      reason: String(values.get("reason") || "").trim(),
      audit_reason: String(values.get("audit_reason") || "").trim(),
    });


    const submitMatchedImpact = async (submittedForm, event) => {
${GOALS_IMPACT_SUBMIT_SCRIPT}    };
    const handleGoalImpactSubmit = (submittedForm, event) => submittedForm.closest?.("[data-impact-create-form], [data-impact-edit-form], [data-impact-deactivate-form]")
      ? submitMatchedImpact(submittedForm, event) : null;
    return { handleGoalImpactSubmit };
  }`;
