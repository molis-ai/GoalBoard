/** Goal-owned browser behavior, mounted by Workbench at the existing event/initialization position. */
const GOALS_LIFECYCLE_CLICK_SCRIPT = `      const archiveAction = target.closest("[data-goal-archive]");
      const activeGoalAction = target.closest("[data-set-active-goal]");
      if (activeGoalAction) {
        activeGoalAction.disabled = true;
        const goalId = activeGoalAction.dataset.goalId;
        try {
          const response = await fetch(route("/api/goals/" + encodeURIComponent(goalId) + "/active"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({ reason: "用户在 GoalBoard 设为当前 Goal" }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "无法设为当前 Goal");
          await refreshBoard(true);
          showToast("已设为当前 Goal；Runtime 的执行状态没有改变");
        } catch (error) {
          activeGoalAction.disabled = false;
          showToast(error.message || "无法设为当前 Goal", true);
        }
        return;
      }
      if (archiveAction) {
        archiveAction.disabled = true;
        const archived = archiveAction.dataset.goalArchive === "true";
        const goalId = archiveAction.dataset.goalId;
        try {
          const response = await fetch(route("/api/goals/" + encodeURIComponent(goalId) + "/archive"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({
              archived,
              reason: archived ? "用户在 GoalBoard 手动归档已完成 Goal" : "用户在 GoalBoard 恢复归档 Goal",
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "操作失败");
          navigate(route((archived ? "/archive/goals/" : "/goals/") + encodeURIComponent(goalId)));
        } catch (error) {
          archiveAction.disabled = false;
          showToast(error.message || "操作失败", true);
        }
        return;
      }
`;

/** Explicit user lifecycle requests; authoritative rules remain on the application API. */
export const GOALS_LIFECYCLE_CLIENT_FACTORY_SCRIPT = `(host) => {
    const { route, controlHeaders: goalboardControlHeaders, refreshBoard, showToast, navigate } = host;
    const handleMatchedLifecycleClick = async (target) => {
${GOALS_LIFECYCLE_CLICK_SCRIPT}    };
    const handleGoalLifecycleClick = (target) => target.closest("[data-set-active-goal], [data-goal-archive]")
      ? handleMatchedLifecycleClick(target) : null;
    return { handleGoalLifecycleClick };
  }`;
