/** AP3 Workbench client segment: events-secondary. */
export const CLIENT_EVENTS_SECONDARY_SCRIPT = `        return;
      }
      if (target.closest("[data-feed-gmail-oauth-start]")) {
        const button = target.closest("[data-feed-gmail-oauth-start]");
        const clientId = feedSourcesDialog?.querySelector("[data-feed-gmail-client-id]")?.value || "";
        const clientSecret = feedSourcesDialog?.querySelector("[data-feed-gmail-client-secret]")?.value || "";
        button.disabled = true;
        try {
          const result = await feedApi("/api/feed/connectors/gmail/oauth/start", "POST", {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: location.origin + route("/api/feed/connectors/gmail/oauth/callback"),
          });
          location.assign(result.authorizationUrl);
        } catch (error) {
          setFeedSourceFeedback(error.message || L("Gmail 授权启动失败"), true);
          button.disabled = false;
        }
        return;
      }
      if (target.closest("[data-relay-import-open]")) {
        feedSourcesDialog?.close();
        relayImportDialog?.showModal();
        return;
      }
      if (target.closest("[data-relay-import-confirm]")) {
        const button = target.closest("[data-relay-import-confirm]");
        const errorBox = relayImportDialog?.querySelector("[data-relay-import-error]");
        const original = button.textContent;
        button.disabled = true;
        button.textContent = L("正在迁移…");
        if (errorBox) errorBox.hidden = true;
        try {
          const response = await fetch(route("/api/feed/import"), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify({ user_confirmed: true }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("Relay 迁移失败"));
          saveUiState();
          location.reload();
        } catch (error) {
          if (errorBox) {
            errorBox.textContent = error.message || L("Relay 迁移失败");
            errorBox.hidden = false;
          }
          button.disabled = false;
          button.textContent = original;
        }
        return;
      }
      if (target.closest("[data-feed-clear-filters]")) {
        if (feedSearch) feedSearch.value = "";
        if (feedSourceFilter) feedSourceFilter.value = "all";
        if (feedTypeFilter) feedTypeFilter.value = "all";
        if (feedTimeFilter) feedTimeFilter.value = "all";
        if (feedStatusFilter) feedStatusFilter.value = "active";
        if (feedSort) feedSort.value = "newest";
        syncFeedFilterUi();
        setFeedFilterOpen(false);
        filterFeedItems(false);
        return;
      }
      if (target.closest("[data-retry-feed-detail]")) {
        if (feedWorkbench?.dataset.loaded !== "true") {
          void ensureFeedWorkbenchLoaded();
          return;
        }
        const selectedRow = [...(feedList?.querySelectorAll("[data-feed-entry-id]") || [])]
          .find((row) => row.dataset.feedEntryId === selectedFeedItem);
        if (selectedRow) void loadFeedItemDetail(selectedRow, selectedFeedItem);
        return;
      }
      const openSourceRecord = target.closest("[data-open-source-record]");
      if (openSourceRecord) {
        const sourceId = openSourceRecord.dataset.openSourceRecord;
        if (!sourceId || !sourceList?.querySelector('[data-source-entry-id="' + CSS.escape(sourceId) + '"]')) {
          showToast(L("这个来源已删除或暂时不可用"));
          return;
        }
        setDesktopDirectory("sources", true, false, openSourceRecord);
        setDesktopWorkSurface("sources", true, false);
        selectSource(sourceId, true);
        return;
      }
      const feedEntry = target.closest("[data-feed-entry-id]");
      if (feedEntry) {
        selectFeedItem(feedEntry.dataset.feedEntryId, true, true);
        return;
      }
      const inboxOpenFeed = target.closest("[data-inbox-open-feed]");
      if (inboxOpenFeed) {
        const itemId = inboxOpenFeed.dataset.inboxOpenFeed;
        if (!itemId) return;
        setFeedPreset("feed", true);
        setDesktopDirectory("feed", true, false, inboxOpenFeed);
        setDesktopWorkSurface("feed", true, false);
        selectFeedItem(itemId, true, true);
        return;
      }
      const inboxAction = target.closest("[data-inbox-action]");
      if (inboxAction) {
        const statusValue = inboxAction.dataset.inboxAction;
        const entryId = inboxAction.dataset.inboxEntryId;
        const expectedRevision = Number(inboxAction.dataset.inboxEntryRevision || 0) || undefined;
        if (!statusValue || !entryId || !expectedRevision) return;
        const status = inboxAction.closest("[data-feed-detail]")?.querySelector("[data-inbox-action-status], [data-feed-action-status]");
        const original = inboxAction.innerHTML;
        inboxAction.disabled = true;
        inboxAction.setAttribute("aria-busy", "true");
        if (status) status.hidden = true;
        try {
          await feedApi("/api/inbox/entries/" + encodeURIComponent(entryId) + "/status", "POST", {
            status: statusValue,
            expected_revision: expectedRevision,
          });
          saveUiState();
          location.reload();
        } catch (error) {
          if (status) {
            status.textContent = error.message || L("Inbox 操作失败");
            status.hidden = false;
          }
          inboxAction.disabled = false;
          inboxAction.removeAttribute("aria-busy");
          inboxAction.innerHTML = original;
        }
        return;
      }
      const feedAction = target.closest("[data-feed-action]");
      if (feedAction) {
        const action = feedAction.dataset.feedAction;
        const itemId = feedAction.dataset.feedItemId;
        if (!action || !itemId) return;
        const status = feedAction.closest("[data-feed-detail]")?.querySelector("[data-feed-action-status]");
        const original = feedAction.innerHTML;
        feedAction.disabled = true;
        feedAction.setAttribute("aria-busy", "true");
        if (status) status.hidden = true;
        try {
          const expectedRevision = Number(feedAction.dataset.feedRevision || 0) || undefined;
          const restoreTarget = feedAction.dataset.feedRestoreTarget;
          const response = await fetch(route("/api/feed/items/" + encodeURIComponent(itemId) + "/" + action), {
            method: "POST",
            headers: goalboardControlHeaders(),
            body: JSON.stringify(expectedRevision
              ? { expected_revision: expectedRevision, ...(restoreTarget ? { restore_target: restoreTarget } : {}) }
              : {}),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || L("Item 操作失败"));
          if (action === "promote" || action === "start") {
            saveUiState();
            let existing = {};
            try { existing = JSON.parse(sessionStorage.getItem(currentGoalUiStorageKey) || sessionStorage.getItem(goalUiStorageKey) || "null") || {}; } catch {}
            if (action === "start" && result.runtime_autofill && result.goal_id) {
              sessionStorage.setItem("goalboard-feed-runtime-autofill:" + result.goal_id, JSON.stringify({ itemId, at: Date.now() }));
            }
            sessionStorage.setItem(currentGoalUiStorageKey, JSON.stringify({
              ...existing,
              selected: result.goal_id,
              navigationVersion: desktopNavigationStateVersion,
              directory: "goals",
              workSurface: "goal",
              workspaceMode: action === "start" ? "runtime" : "focus",
              mobileView: action === "start" ? "tui" : "document",
            }));
            location.assign(globalThis.goalboardNavigationUrl(result.goal_path + (action === "start" ? "?feed-start=1" : "")));
            return;
          }
          saveUiState();
          location.reload();
        } catch (error) {
          if (status) {
            status.textContent = error.message || L("Item 操作失败");
            status.hidden = false;
          }
          feedAction.disabled = false;
          feedAction.removeAttribute("aria-busy");
          feedAction.innerHTML = original;
        }
        return;
      }
      const surfaceLink = target.closest("[data-work-surface-link]");
      if (surfaceLink) {
        saveUiState();
        const surface = surfaceLink.dataset.workSurfaceLink || "inbox";
        if (desktopWorkSurfaces.some((candidate) => candidate.dataset.workSurface === surface)) {
          event.preventDefault();
          setDesktopDirectory("root", true, false, surfaceLink);
          setDesktopWorkSurface(surface, true, true);
          if (surface === "feed" && selectedFeedItem) selectFeedItem(selectedFeedItem, false, true);
        }
        return;
      }
      const surfaceOpen = target.closest("[data-work-surface-open]");
      if (surfaceOpen) {
        const surface = surfaceOpen.dataset.workSurfaceOpen || "goal";
        if (surface === "feed") {
          setFeedPreset(surfaceOpen.dataset.feedPreset || "inbox_message", true);
          const source = surfaceOpen.dataset.feedSource;
          if (source) {
            if (feedSearch) feedSearch.value = "";
            if (feedSourceFilter) {
              feedSourceFilter.value = source;
              if (!feedSourceFilter.value) feedSourceFilter.value = "all";
            }
            if (feedTypeFilter) feedTypeFilter.value = "all";
            if (feedTimeFilter) feedTimeFilter.value = "all";
            if (feedStatusFilter) feedStatusFilter.value = "active";
            if (feedSort) feedSort.value = "newest";
            syncFeedFilterUi();
            filterFeedItems(false);
          }
        }
        const available = desktopWorkSurfaces.some((candidate) => candidate.dataset.workSurface === surface);
        if (surface === "goal" && (decisionView || !available)) {
          saveUiState();
          restoreLastGoal(true);
          return;
        }
        setDesktopDirectory(surface === "goal"
          ? "goals"
          : surface === "feed" || surface === "sources" || surface === "sessions"
            ? surface
            : "root", true, true, surfaceOpen);
        setDesktopWorkSurface(surface, true, true);
        if (surface === "feed" && selectedFeedItem) selectFeedItem(selectedFeedItem, false, true);
        if (matchMedia("(max-width: 760px)").matches) setMobileView("tree");
        return;
      }
      const directoryOpen = target.closest("[data-directory-open]");
      if (directoryOpen && desktopDirectoryPanels.length) {
        if (directoryOpen.matches("[data-mobile-directory-root]")) setMobileView("tree");
        setDesktopDirectory(directoryOpen.dataset.directoryOpen || "root", true, true, directoryOpen);
        return;
      }
      if (target.closest("[data-directory-back]") && desktopDirectoryPanels.length) {
        setDesktopDirectory("root");
        return;
      }
      const goalWorkTabClick = handleGoalWorkTabClick(target);
      if (goalWorkTabClick) { await goalWorkTabClick; return; }
      if (handleTreeSearchFocus(target)) return;
      if (handleTreeDisclosureClick(target)) return;
      if (handleMomentumNavigationClick(target)) return;
      const workbenchViewButton = target.closest("button[data-workbench-view]");
      if (workbenchViewButton) {
        setWorkspaceMode(workbenchViewButton.dataset.workbenchView);
        return;
      }
      if (target.closest("[data-tui-focus-return]")) {
        setWorkspaceMode("focus");
        return;
      }
      if (target.closest("[data-directory-toggle]")) {
        setDirectoryCollapsed(!workspace.classList.contains("is-directory-collapsed"));
        return;
      }
      if (handleMomentumSelectionClick(target)) return;
      if (handleMomentumZoomClick(target)) return;
      if (handleGoalSelectClick(target)) return;
      if (handleGoalDialogClick(target)) return;
      if (handleTreeCollapseAllClick(target)) return;
      const mobileTarget = target.closest("[data-mobile-target]");
      if (mobileTarget) {
        const mobileView = mobileTarget.dataset.mobileTarget;
        if (mobileView === "document") setWorkspaceMode("focus", false);
        if (mobileView === "tui") setWorkspaceMode("runtime", false);
        setMobileView(mobileView);
        saveUiState();
        return;
      }
      const focusSectionTrigger = target.closest("[data-focus-section-trigger]");
      if (focusSectionTrigger) {
        const factor = focusSectionTrigger.dataset.goalFactorTab;
        if (factor) setGoalFactor(factor, true, true);
        else activateFocusSection(focusSectionTrigger);
        return;
      }
      if (handleGoalFactorClick(target)) return;
      const draftOpen = handleGoalDraftOpen(target);
      if (draftOpen) { await draftOpen; return; }
      if (target.closest("[data-open-goal-tui]")) {
        setWorkspaceMode("runtime");
        const addTerminal = document.querySelector("[data-tui-add]");
        if (addTerminal) addTerminal.click();
        return;
      }
      const sectionLink = target.closest('a[href^="#"]');
      if (sectionLink) {
        const targetId = sectionLink.getAttribute("href")?.slice(1);
        const targetElement = targetId ? document.getElementById(targetId) : null;
        const targetReader = targetId ? eventReaderFromTargetId(targetId) : "";
        const targetFactor = targetId ? goalFactorFromTargetId(targetId) : "";
        if (targetId && (targetElement || targetReader || targetFactor)) {
          event.preventDefault();
          if (targetReader) openEventReader(targetReader);
          if (targetFactor) setGoalFactor(targetFactor, true);
          history.replaceState(null, "", "#" + targetId);
          if (targetElement) {
            const deepLinkScrollTarget = revealDeepLinkTarget(targetElement);
            requestAnimationFrame(() => deepLinkScrollTarget.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }));
          }
          return;
        }
      }
      const copy = target.closest("[data-copy-value]");
      if (copy) {
        try {
          await navigator.clipboard.writeText(copy.dataset.copyValue);
          showToast("引用已复制");
        } catch {
          showToast("无法访问剪贴板，请手动复制", true);
        }
        return;
      }
      if (handleGoalRelationDisclosureClick(target)) return;
      if (handleGoalDraftCriteriaClick(target)) return;
      const lifecycleClick = handleGoalLifecycleClick(target);
      if (lifecycleClick) { await lifecycleClick; return; }
`;
