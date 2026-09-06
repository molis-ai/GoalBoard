/** Goal proposal decisions; Workbench supplies transport and cross-surface refresh/receipts. */
export const GOALS_PROPOSAL_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { translate: L, route, controlHeaders: goalboardControlHeaders, decisionReceiptContext, refreshBoardWithDecisionReceipt } = host;
    const requireDecisionText = (decisionForm, errorBox, fieldName, message) => {
      const field = decisionForm.querySelector('[name="' + fieldName + '"]');
      if (String(field?.value || "").trim()) {
        field?.removeAttribute("aria-invalid");
        return false;
      }
      errorBox.textContent = L(message);
      errorBox.hidden = false;
      field?.setAttribute("aria-invalid", "true");
      field?.focus();
      const clearError = () => {
        if (!String(field?.value || "").trim()) return;
        field.removeAttribute("aria-invalid");
        errorBox.hidden = true;
        field.removeEventListener("input", clearError);
        field.removeEventListener("change", clearError);
      };
      field?.addEventListener("input", clearError);
      field?.addEventListener("change", clearError);
      return true;
    };

    const humanDecisionError = (message, fallback) => String(message || fallback)
      .replaceAll("Contract Proposal", "目标说明")
      .replaceAll("Contract", "目标说明")
      .replaceAll("Candidate Goal", "新发现的工作")
      .replaceAll("Candidate", "新发现的工作")
      .replaceAll("Goal Spine", "Goal Tree")
      .replaceAll("Rewire", "Goal 关系调整")
      .replaceAll("Review", "结果确认")
      .replaceAll("Risk", "风险")
      .replaceAll("Impact", "影响范围")
      .replaceAll("Policy", "工作规则")
      .replaceAll("Runtime", "执行工具");

    const submitDecisionForm = async (decisionForm, submitter, endpoint, decision, successMessage) => {
      const buttons = [...decisionForm.querySelectorAll('button[type="submit"]')];
      const errorBox = decisionForm.querySelector("[data-decision-error]");
      const reason = String(new FormData(decisionForm).get("reason") || "").trim();
      const receiptContext = decisionReceiptContext(decisionForm);
      if (requireDecisionText(decisionForm, errorBox, "reason", "请填写决定理由或修改意见")) return;
      const buttonStates = buttons.map((button) => button.disabled);
      const submitLabel = submitter?.textContent;
      buttons.forEach((button) => { button.disabled = true; });
      if (submitter) submitter.textContent = L("正在保存…");
      errorBox.hidden = true;
      try {
        const response = await fetch(route(endpoint), {
          method: "POST",
          headers: goalboardControlHeaders(),
          body: JSON.stringify({ decision, reason }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "决定提交失败");
        await refreshBoardWithDecisionReceipt(
          typeof successMessage === "function" ? successMessage(result) : successMessage,
          receiptContext,
        );
      } catch (error) {
        errorBox.textContent = humanDecisionError(error.message, "决定提交失败，请检查输入后重试");
        errorBox.hidden = false;
        buttons.forEach((button, index) => { button.disabled = buttonStates[index]; });
        if (submitter) submitter.textContent = submitLabel;
      }
    };

    const submitMatchedProposal = async (submittedForm, event) => {
      const goalTreeDecisionForm = submittedForm.closest?.("[data-goal-tree-decision-form]");
      if (goalTreeDecisionForm) {
        event.preventDefault();
        const decision = event.submitter?.value;
        const buttons = [...goalTreeDecisionForm.querySelectorAll('button[type="submit"]')];
        const errorBox = goalTreeDecisionForm.querySelector("[data-decision-error]");
        const values = new FormData(goalTreeDecisionForm);
        const reason = String(values.get("reason") || "").trim();
        const itemIds = values.getAll("item_id").map((value) => String(value));
        const receiptContext = decisionReceiptContext(goalTreeDecisionForm);
        const hasSystemIssues = goalTreeDecisionForm.dataset.hasSystemIssues === "true";
        if (decision === "repair-risks") {
          const repairs = [];
          let firstMissing = null;
          for (const repairGroup of goalTreeDecisionForm.querySelectorAll("[data-risk-proposal-repair]")) {
            const selected = repairGroup.querySelector('input[type="radio"]:checked');
            const localError = repairGroup.querySelector("[data-risk-repair-error]");
            if (!selected) {
              localError.textContent = L("请选择这条风险的处理方式");
              localError.hidden = false;
              firstMissing ||= repairGroup.querySelector('input[type="radio"]');
              continue;
            }
            localError.hidden = true;
            repairs.push({
              item_id: repairGroup.dataset.riskItemId,
              treatment: selected.value,
              treatment_plan: String(repairGroup.querySelector("[data-risk-treatment-plan]")?.value || "").trim(),
            });
          }
          if (firstMissing) {
            firstMissing.focus();
            return;
          }
          if (!repairs.length) {
            errorBox.textContent = L("这份方案已经变化，暂时不能提交。请刷新后重试。");
            errorBox.hidden = false;
            return;
          }
          const submitLabel = event.submitter?.textContent;
          const buttonStates = buttons.map((button) => button.disabled);
          buttons.forEach((button) => { button.disabled = true; });
          if (event.submitter) event.submitter.textContent = L("正在保存…");
          errorBox.hidden = true;
          try {
            const response = await fetch(route("/api/goal-tree-proposals/" + encodeURIComponent(goalTreeDecisionForm.dataset.goalTreeProposalId) + "/decision"), {
              method: "POST",
              headers: goalboardControlHeaders(),
              body: JSON.stringify({ risk_repairs: repairs }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || L("风险处理保存失败"));
            await refreshBoardWithDecisionReceipt(
              L("风险处理已保存。方案的其他内容没有改变，仍需补全的问题会继续显示。"),
              receiptContext,
            );
          } catch (error) {
            errorBox.textContent = humanDecisionError(error.message, L("风险处理保存失败，请重试"));
            errorBox.hidden = false;
            buttons.forEach((button, index) => { button.disabled = buttonStates[index]; });
            if (event.submitter) event.submitter.textContent = submitLabel;
          }
          return;
        }
        if ((decision === "confirm" || (decision === "reject" && !hasSystemIssues)) &&
            requireDecisionText(goalTreeDecisionForm, errorBox, "reason", "请填写决定理由或修改意见")) return;
        if (!itemIds.length) {
          errorBox.textContent = L("这份方案已经变化，暂时不能提交。请让 Runtime 按最新状态重新整理。");
          errorBox.hidden = false;
          return;
        }
        const submitLabel = event.submitter?.textContent;
        const buttonStates = buttons.map((button) => button.disabled);
        buttons.forEach((button) => { button.disabled = true; });
        if (event.submitter) event.submitter.textContent = L("正在保存…");
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/goal-tree-proposals/" + encodeURIComponent(goalTreeDecisionForm.dataset.goalTreeProposalId) + "/decision"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({
              ...(decision === "confirm"
                ? { confirm_all_pending: true }
                : { decisions: itemIds.map((itemId) => ({ item_id: itemId, decision, reason })) }),
              reason,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("方案决定提交失败"));
          if (Array.isArray(result.conflict_item_ids) && result.conflict_item_ids.length) {
            throw new Error(L("GoalBoard 已经发生变化。请让 Runtime 更新方案后再决定。"));
          }
          await refreshBoardWithDecisionReceipt(
            decision === "confirm" ? L("这份 Goal 方案已经采用，相关 Goal 和关系已更新。") : L("这份 Goal 方案已退回，当前 Goal Tree 保持不变。"),
            receiptContext,
          );
        } catch (error) {
          errorBox.textContent = humanDecisionError(error.message, L("方案决定提交失败，请重试"));
          errorBox.hidden = false;
          buttons.forEach((button, index) => { button.disabled = buttonStates[index]; });
          if (event.submitter) event.submitter.textContent = submitLabel;
        }
        return;
      }
      const contractDecisionForm = submittedForm.closest?.("[data-contract-decision-form]");
      if (contractDecisionForm) {
        event.preventDefault();
        const decision = event.submitter?.value;
        await submitDecisionForm(
          contractDecisionForm,
          event.submitter,
          "/api/contract-proposals/" + encodeURIComponent(contractDecisionForm.dataset.contractProposalId) + "/decision",
          decision,
          decision === "approved" ? L("目标说明已确认，现在可以进入执行。") : L("目标说明已退回，草稿保持不变。"),
        );
        return;
      }

      const candidateDecisionForm = submittedForm.closest?.("[data-candidate-decision-form]");
      if (candidateDecisionForm) {
        event.preventDefault();
        const decision = event.submitter?.value;
        await submitDecisionForm(
          candidateDecisionForm,
          event.submitter,
          "/api/candidates/" + encodeURIComponent(candidateDecisionForm.dataset.candidateId) + "/decision",
          decision,
          decision === "approved" ? L("新工作已加入 Goal Tree；需要调整关系时会继续出现在这里。") : L("这项新工作暂未加入，你的意见已保留。"),
        );
        return;
      }

      const rewireDecisionForm = submittedForm.closest?.("[data-rewire-decision-form]");
      if (rewireDecisionForm) {
        event.preventDefault();
        const decision = event.submitter?.value;
        await submitDecisionForm(
          rewireDecisionForm,
          event.submitter,
          "/api/rewires/" + encodeURIComponent(rewireDecisionForm.dataset.rewireId) + "/decision",
          decision,
          decision === "confirmed"
            ? (result) => {
                const impact = result?.rewire?.impact || {};
                const added = Array.isArray(impact.added_relation_ids) ? impact.added_relation_ids.length : 0;
                const removed = Array.isArray(impact.deactivated_relation_ids) ? impact.deactivated_relation_ids.length : 0;
                const risks = Array.isArray(impact.added_risk_ids) ? impact.added_risk_ids.length : 0;
                const changes = [];
                if (added) changes.push(L("新增 {count} 条关系", { count: added }));
                if (removed) changes.push(L("解除 {count} 条关系", { count: removed }));
                if (risks) changes.push(L("新增 {count} 项风险", { count: risks }));
                return changes.length
                  ? L("已{changes}。", { changes: changes.join("、") })
                  : L("决定已记录，但这次没有新增或解除 Goal 关系，也没有新增风险。");
              }
            : L("这次调整未采用，现有 Goal 关系没有改变。"),
        );
        return;
      }
    };
    const handleGoalProposalSubmit = (submittedForm, event) => submittedForm.closest?.("[data-goal-tree-decision-form], [data-contract-decision-form], [data-candidate-decision-form], [data-rewire-decision-form]")
      ? submitMatchedProposal(submittedForm, event) : null;
    return { handleGoalProposalSubmit, requireDecisionText, humanDecisionError };
  }`;
