/** AP3 Workbench client segment: events-accessibility. */
export const CLIENT_EVENTS_ACCESSIBILITY_SCRIPT = `    });

    document.addEventListener("submit", async (event) => {
      const submittedForm = event.target;
      const trashSubmit = handleGoalTrashSubmit(submittedForm, event);
      if (trashSubmit) { await trashSubmit; return; }
      const proposalSubmit = handleGoalProposalSubmit(submittedForm, event);
      if (proposalSubmit) { await proposalSubmit; return; }

      const relationSubmit = handleGoalRelationSubmit(submittedForm, event);
      if (relationSubmit) { await relationSubmit; return; }
      const draftSubmit = handleGoalDraftSubmit(submittedForm, event);
      if (draftSubmit) { await draftSubmit; return; }
      const riskFactsSubmit = handleRiskFactsSubmit(submittedForm, event);
      if (riskFactsSubmit) { await riskFactsSubmit; return; }
      const riskStateForm = submittedForm.closest?.("[data-risk-state-form]");
      if (riskStateForm) {
        event.preventDefault();
        const submit = riskStateForm.querySelector('button[type="submit"]');
        const errorBox = riskStateForm.querySelector("[data-risk-error]");
        const receiptContext = decisionReceiptContext(riskStateForm);
        if (requireDecisionText(riskStateForm, errorBox, "state", "请选择风险处理结果，再保存。")) return;
        if (requireDecisionText(riskStateForm, errorBox, "reason", "请填写决定理由。说明你为什么这样选择，以及依据是什么。")) return;
        const values = new FormData(riskStateForm);
        if (values.get("state") === "resolved") {
          if (requireDecisionText(riskStateForm, errorBox, "resolution_summary", "请写清什么事实证明这条风险已经解决。")) return;
          if (requireDecisionText(riskStateForm, errorBox, "resolution_evidence_refs", "请至少填写一条可追溯的证据引用。")) return;
        }
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/risks/" + encodeURIComponent(riskStateForm.dataset.riskId) + "/state"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({
              state: values.get("state"),
              reason: String(values.get("reason") || "").trim(),
              goal_id: riskStateForm.dataset.goalId,
              action_id: riskStateForm.dataset.actionId,
              action_token: riskStateForm.dataset.actionToken,
              contract_revision: Number(riskStateForm.dataset.contractRevision),
              ...(values.get("state") === "resolved" ? {
                resolution_basis: {
                  summary: String(values.get("resolution_summary") || "").trim(),
                  evidence_refs: String(values.get("resolution_evidence_refs") || "").split(/[\\n]+/).map((value) => value.trim()).filter(Boolean),
                  residual_gaps: String(values.get("resolution_residual_gaps") || "").split(/[\\n]+/).map((value) => value.trim()).filter(Boolean),
                },
              } : {}),
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Risk 状态更新失败");
          const resultState = result?.decision || result?.risk?.state;
          const resultMessages = {
            open: L("风险保持待处理，仍会留在待决定中，并继续按当前规则影响关联 Goal。"),
            triggered: L("风险已标记为发生，仍会留在待决定中，并继续按当前规则影响关联 Goal。"),
            resolved: L("风险已标记为解决，不再阻止关联 Goal。"),
            accepted: L("风险已接受，不再阻止关联 Goal。"),
            expired: L("风险已过期，不再继续跟踪或阻止关联 Goal。"),
            rejected: L("你没有接受这项风险，已改为由 Runtime 继续处理。"),
          };
          await refreshBoardWithDecisionReceipt(
            resultMessages[resultState] || L("风险处理方式已记录。"),
            receiptContext,
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, "风险决定保存失败，请检查输入后重试");
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }

      const impactSubmit = handleGoalImpactSubmit(submittedForm, event);
      if (impactSubmit) { await impactSubmit; return; }
      const evidenceForm = submittedForm.closest?.("[data-evidence-form]");
      if (evidenceForm) {
        event.preventDefault();
        const submit = evidenceForm.querySelector('button[type="submit"]');
        const errorBox = evidenceForm.querySelector("[data-evidence-error]");
        const values = new FormData(evidenceForm);
        const criterionIds = [...new Set(values.getAll("criterion_ids").map(String).map((value) => value.trim()).filter(Boolean))];
        if (!criterionIds.length) {
          errorBox.textContent = "至少选择一条验收条件";
          errorBox.hidden = false;
          return;
        }
        const submitLabel = submit.textContent;
        submit.disabled = true;
        submit.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/goals/" + encodeURIComponent(evidenceForm.dataset.goalId) + "/evidence"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({
              criterion_ids: criterionIds,
              kind: values.get("kind"),
              result: values.get("result"),
              locator: String(values.get("locator") || "").trim(),
              digest: String(values.get("digest") || "").trim(),
              action_token: evidenceForm.dataset.actionToken,
              contract_revision: Number(evidenceForm.dataset.contractRevision),
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("完成依据记录失败"));
          await refreshBoard(true);
          showToast(result?.transition?.summary || L("完成依据已记录，并已绑定到当前 Goal"));
        } catch (error) {
          errorBox.textContent = error.message || L("完成依据记录失败，请检查输入后重试");
          errorBox.hidden = false;
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
        return;
      }

      const policySubmit = handleGoalPolicySubmit(submittedForm, event);
      if (policySubmit) { await policySubmit; return; }
`;
