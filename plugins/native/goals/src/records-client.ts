/** Existing Goal presentation loading; shared Host dependencies remain explicitly composed. */
const GOALS_RECORDS_LOAD_SCRIPT = `    const clearGoalRecordsRequest = (controller) => {
      if (goalRecordsRequest === controller) {
        goalRecordsRequest = null;
        resetGoalRecordsUi();
        resetGoalRecordsUi = null;
      }
    };

    const abortGoalRecordsRequest = () => {
      goalRecordsRequest?.abort();
      if (goalRecordsRequest) clearGoalRecordsRequest(goalRecordsRequest);
    };

    const loadGoalRecords = async (article) => {
      const container = article?.querySelector("[data-goal-records-content]");
      if (!container || container.dataset.loaded === "true" || container.dataset.loading === "true") return;
      const goalId = article.dataset.goalView;
      if (!goalId) return;
      abortGoalRecordsRequest();
      const controller = new AbortController();
      goalRecordsRequest = controller;
      resetGoalRecordsUi = () => {
        container.dataset.loading = "false";
        container.removeAttribute("aria-busy");
      };
      container.dataset.loading = "true";
      container.setAttribute("aria-busy", "true");
      try {
        const response = await fetch(
          route("/api/goals/" + encodeURIComponent(goalId) + "/records?view=" + documentCollection),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(L("无法读取这条 Goal 的完整记录"));
        const template = document.createElement("template");
        template.innerHTML = (await response.text()).trim();
        const records = template.content.querySelector('[data-goal-section="technical"]');
        if (!records) throw new Error(L("Goal 记录响应不完整"));
        if (!article.isConnected || article.dataset.goalView !== goalId || goalRecordsRequest !== controller) return;
        container.replaceChildren(records);
        container.dataset.loaded = "true";
        const hashTargetId = decodeURIComponent(location.hash.slice(1));
        if (hashTargetId) afterLoad(hashTargetId);
      } catch (error) {
        if (isAbortError(error) || goalRecordsRequest !== controller) return;
        if (!article.isConnected || article.dataset.goalView !== goalId) return;
        const message = error instanceof Error ? error.message : L("无法载入完整记录");
        const errorRow = document.createElement("p");
        errorRow.className = "empty-row";
        errorRow.setAttribute("role", "alert");
        errorRow.textContent = message;
        container.replaceChildren(errorRow);
        showError(message);
      } finally {
        clearGoalRecordsRequest(controller);
      }
    };

`;

const GOALS_RECORD_EVENTS_CLICK_SCRIPT = `    const handleGoalRecordEventsClick = (target) => {
      const loadMoreEventsButton = target.closest("[data-load-more-goal-events]");
      if (loadMoreEventsButton) {
        return loadMoreGoalEvents(loadMoreEventsButton);
      }
      return null;
    };
`;

const GOALS_RECORD_EVENTS_LOAD_SCRIPT = `    const loadMoreGoalEvents = async (button) => {
      const pagination = button.closest("[data-goal-event-pagination]");
      const article = button.closest("[data-goal-view]");
      const eventList = article?.querySelector("[data-goal-event-list]");
      const goalId = article?.dataset.goalView;
      const offset = Number.parseInt(pagination?.dataset.nextOffset || "", 10);
      if (!pagination || !eventList || !goalId || !Number.isSafeInteger(offset) || offset < 0) return;
      abortGoalRecordsRequest();
      const controller = new AbortController();
      goalRecordsRequest = controller;
      const defaultLabel = button.textContent;
      const errorBox = pagination.querySelector("[data-goal-event-error]");
      resetGoalRecordsUi = () => {
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = defaultLabel;
        }
      };
      button.disabled = true;
      button.textContent = L("正在载入…");
      if (errorBox) errorBox.hidden = true;
      try {
        const response = await fetch(
          route("/api/goals/" + encodeURIComponent(goalId) + "/record-events?view=" + documentCollection + "&offset=" + offset),
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error(L("无法读取更早的 Goal 记录"));
        const template = document.createElement("template");
        template.innerHTML = (await response.text()).trim();
        const page = template.content.querySelector("[data-goal-event-page]");
        const pageList = page?.querySelector("ol");
        if (!page || !pageList) throw new Error(L("Goal 事件响应不完整"));
        if (!article.isConnected || article.dataset.goalView !== goalId || goalRecordsRequest !== controller) return;
        eventList.append(...Array.from(pageList.children));
        const nextOffset = Number.parseInt(page.dataset.nextOffset || "", 10);
        const total = Number.parseInt(page.dataset.total || "", 10);
        if (!Number.isSafeInteger(nextOffset) || !Number.isSafeInteger(total)) throw new Error(L("Goal 事件响应不完整"));
        pagination.dataset.nextOffset = String(nextOffset);
        pagination.dataset.total = String(total);
        const progress = pagination.querySelector("[data-goal-event-progress]");
        if (progress) progress.textContent = L("已显示 {shown}/{total} 条事件", { shown: nextOffset, total });
        if (page.dataset.hasMore !== "true") button.remove();
      } catch (error) {
        if (isAbortError(error) || goalRecordsRequest !== controller) return;
        if (!article.isConnected || article.dataset.goalView !== goalId) return;
        const message = error instanceof Error ? error.message : L("无法载入更早记录");
        if (errorBox) {
          errorBox.textContent = message;
          errorBox.hidden = false;
        }
      } finally {
        clearGoalRecordsRequest(controller);
      }
    };

`;

/** Full records and pagination share one request only inside this instance. */
export const GOALS_RECORDS_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { documentCollection, route, translate: L, isAbortError, showError, afterLoad } = host;
    let goalRecordsRequest = null;
    let resetGoalRecordsUi = null;
${GOALS_RECORDS_LOAD_SCRIPT}${GOALS_RECORD_EVENTS_LOAD_SCRIPT}${GOALS_RECORD_EVENTS_CLICK_SCRIPT}
    return { abortGoalRecordsRequest, loadGoalRecords, loadMoreGoalEvents, handleGoalRecordEventsClick };
  }`;
