/** Goal draft editing, bound to explicit Workbench services. */
const GOALS_DRAFT_RENUMBER_SCRIPT = `    const renumberCriteria = (list) => {
      [...list.querySelectorAll("[data-criterion-row]")].forEach((row, index) => {
        const label = row.querySelector("[data-criterion-number]");
        if (label) label.textContent = "验收条件 " + (index + 1);
      });
    };

`;

const GOALS_DRAFT_TARGET_SCRIPT = `    const parseCriterionTarget = (value) => {
      const text = String(value || "").trim();
      if (!text) return null;
      try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : { value: parsed };
      } catch {
        return { value: text };
      }
    };

`;

const GOALS_DRAFT_SUBMIT_SCRIPT = `
        event.preventDefault();
        const submit = draftForm.querySelector('button[type="submit"]');
        const errorBox = draftForm.querySelector("[data-draft-error]");
        const values = new FormData(draftForm);
        const acceptanceCriteria = [...draftForm.querySelectorAll("[data-criterion-row]")]
          .map((row) => {
            const read = (field) => String(row.querySelector('[data-criterion-field="' + field + '"]')?.value || "").trim();
            const statement = read("statement");
            const passCondition = read("pass_condition");
            if (!statement && !passCondition) return null;
            return {
              criterion_id: read("criterion_id") || undefined,
              statement,
              decision_method: read("decision_method") || "inspection",
              pass_condition: passCondition,
              target: parseCriterionTarget(read("target")),
              required_evidence: [...new Set(read("required_evidence").split(/[,，\\n]/).map((item) => item.trim()).filter(Boolean))],
            };
          })
          .filter(Boolean);
        submit.disabled = true;
        errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/goals/" + encodeURIComponent(draftForm.dataset.goalId) + "/draft"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({
              title: String(values.get("title") || "").trim(),
              outcome: String(values.get("outcome") || "").trim(),
              why: String(values.get("why") || "").trim(),
              business_logic: String(values.get("business_logic") || "").trim(),
              in_scope: splitLines(values.get("in_scope")),
              out_of_scope: splitLines(values.get("out_of_scope")),
              constraints: splitLines(values.get("constraints")),
              required_inputs: splitLines(values.get("required_inputs")),
              promised_outputs: splitLines(values.get("promised_outputs")),
              decomposition_state: values.get("decomposition_state"),
              priority: Number(values.get("priority")),
              acceptance_criteria: acceptanceCriteria,
              reason: String(values.get("reason") || "").trim(),
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Draft 保存失败");
          await refreshBoard(true);
          showToast(L("草稿修改已保存"));
        } catch (error) {
          errorBox.textContent = error.message || "Draft 保存失败，请检查输入";
          errorBox.hidden = false;
          submit.disabled = false;
        }

`;

const GOALS_DRAFT_CRITERIA_SCRIPT = `      const addCriterion = target.closest("[data-add-criterion]");
      if (addCriterion) {
        const editor = addCriterion.closest("[data-draft-editor]");
        const list = editor?.querySelector("[data-criteria-list]");
        const template = editor?.querySelector("[data-criterion-template]");
        if (list && template) {
          list.append(template.content.cloneNode(true));
          renumberCriteria(list);
          list.lastElementChild?.querySelector('[data-criterion-field="statement"]')?.focus();
        }
        return true;
      }
      const removeCriterion = target.closest("[data-remove-criterion]");
      if (removeCriterion) {
        const row = removeCriterion.closest("[data-criterion-row]");
        const list = row?.parentElement;
        if (!row || !list) return true;
        if (list.querySelectorAll("[data-criterion-row]").length === 1) {
          row.querySelectorAll("input, textarea").forEach((control) => { control.value = ""; });
          const method = row.querySelector('[data-criterion-field="decision_method"]');
          if (method) method.value = "inspection";
        } else {
          row.remove();
          renumberCriteria(list);
        }
        return true;
      }
      return false;
`;

const GOALS_DRAFT_OPEN_SCRIPT = `
        if (!await setGoalPanel("completion", true, true, true)) return;
        const editor = article?.querySelector(".goal-edit-disclosure");
        if (editor) {
          editor.open = true;
          editor.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
          requestAnimationFrame(() => editor.querySelector("input, textarea, select")?.focus());
        }

`;

export const GOALS_DRAFT_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { route, controlHeaders: goalboardControlHeaders, splitLines, refreshBoard,
      showToast, translate: L, setGoalPanel } = host;
${GOALS_DRAFT_RENUMBER_SCRIPT}${GOALS_DRAFT_TARGET_SCRIPT}
    const submitDraft = async (draftForm, event) => {
${GOALS_DRAFT_SUBMIT_SCRIPT}    };
    const openDraft = async (article) => {
${GOALS_DRAFT_OPEN_SCRIPT}    };
    const handleGoalDraftSubmit = (submittedForm, event) => {
      const draftForm = submittedForm.closest?.("[data-draft-form]");
      return draftForm ? submitDraft(draftForm, event) : null;
    };
    const handleGoalDraftOpen = (target) => target.closest("[data-open-goal-edit]")
      ? openDraft(target.closest("[data-goal-view]")) : null;
    const handleGoalDraftCriteriaClick = (target) => {
${GOALS_DRAFT_CRITERIA_SCRIPT}    };
    return { handleGoalDraftSubmit, handleGoalDraftOpen, handleGoalDraftCriteriaClick };
  }`;
