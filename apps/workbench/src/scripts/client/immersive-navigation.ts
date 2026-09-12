/** Coordinates application chrome; content and Runtime behavior stay with their Plugin owners. */
export const IMMERSIVE_NAVIGATION_FACTORY_SCRIPT = `(host) => {
  const { workspace, treePane, documentPane, getSelected, getState, getSurface, translate: L,
    setDirectoryCollapsed, setWorkspaceMode, setMobileView } = host;
  if (!document.body.classList.contains("immersive-workbench")) return null;
  const strip = document.querySelector("[data-plugin-strip]");
  const heading = document.querySelector("[data-plugin-heading]");
  const stage = document.querySelector("[data-plugin-stage]");
  const header = document.querySelector(".immersive-titlebar");
  const scrim = document.querySelector("[data-directory-dismiss]");
  const sessionFilters = treePane.querySelector(".project-record-filter-menu");
  const frame = document.querySelector("[data-goal-node-workspace]");
  const workMain = document.querySelector("[data-goal-work-main]");
  const modesKey = "goalboard-goal-work-modes:" + (getState().project?.project_id || getState().snapshot.board.board_id);
  let modes = {};
  try { modes = JSON.parse(localStorage.getItem(modesKey) || "{}"); } catch {}
  const narrow = () => matchMedia("(max-width: 600px)").matches;
  const persistModes = () => { try { localStorage.setItem(modesKey, JSON.stringify(modes)); } catch {} };
  const directoryPlugin = (directory) => directory === "sources" ? "feed" : directory;
  const currentPlugin = () => directoryPlugin(treePane.dataset.desktopDirectory);
  const scrollControls = () => {
    if (!strip) return;
    const overflow = strip.scrollWidth > strip.clientWidth + 1;
    document.querySelector("[data-plugin-scroll-controls]").hidden = !overflow;
    document.querySelector('[data-plugin-scroll="left"]').disabled = strip.scrollLeft <= 1;
    document.querySelector('[data-plugin-scroll="right"]').disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
  };
  const revealPlugin = () => {
    scrollControls();
    const active = strip?.querySelector('[aria-current="page"]');
    if (!active || !strip.clientWidth) return;
    const rect = active.getBoundingClientRect(), viewport = strip.getBoundingClientRect();
    if (rect.left < viewport.left) strip.scrollLeft -= viewport.left - rect.left;
    else if (rect.right > viewport.right) strip.scrollLeft += rect.right - viewport.right;
    scrollControls();
  };
  const syncPresence = () => {
    const drawerOpen = narrow() && workspace.dataset.mobileView === "tree";
    workspace.classList.toggle("is-directory-drawer-open", drawerOpen);
    scrim.hidden = !drawerOpen;
    treePane.toggleAttribute("inert", narrow() && !drawerOpen);
    stage.toggleAttribute("inert", drawerOpen);
    header.toggleAttribute("inert", drawerOpen);
    const editing = Boolean(documentPane.querySelector(".is-editing-goal"));
    const overlayDetails = Boolean(frame && frame.clientWidth < 840 && frame.dataset.detailsOpen === "true");
    workMain?.toggleAttribute("inert", editing || overlayDetails);
  };
  const setDetails = (open, persist = false) => {
    if (!frame) return;
    frame.dataset.detailsOpen = String(open);
    documentPane.hidden = !open;
    const button = frame.querySelector("[data-goal-details-toggle]");
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? L("收起 Goal 信息与时间线") : L("展开 Goal 信息与时间线"));
    if (persist && getSelected()) {
      modes[getSelected()] = { ...modes[getSelected()], details: open };
      persistModes();
    }
    syncPresence();
  };
  const syncGoalMode = () => {
    if (!frame) return;
    const goalId = getSelected();
    const item = getState().goals.find(item => item.goal.goal_id === goalId);
    frame.querySelector("[data-workspace-goal-title]").textContent = item?.goal.title || "";
    const status = frame.querySelector("[data-workspace-goal-status]");
    status.textContent = documentPane.querySelector(".goal-info-popover > summary .goal-status")?.textContent?.trim() || "";
    const saved = modes[goalId] || {};
    const workMode = "terminal";
    frame.dataset.workMode = workMode;
    frame.querySelectorAll("[data-goal-work-mode]").forEach(button => {
      const active = button.dataset.goalWorkMode === workMode;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const terminal = frame.querySelector("[data-tui-pane]");
    if (terminal) { terminal.hidden = workMode !== "terminal"; terminal.setAttribute("role", "tabpanel"); terminal.setAttribute("aria-labelledby", "goal-terminal-tab"); }
    setDetails(saved.details ?? frame.clientWidth >= 840);
    document.dispatchEvent(new CustomEvent("goalboard:work-mode-changed", { detail: { goalId, mode: workMode } }));
  };
  const sync = () => {
    const plugin = currentPlugin();
    heading.hidden = treePane.dataset.desktopDirectory === "root";
    strip?.querySelectorAll("[data-plugin-id]").forEach(button => {
      const active = button.dataset.pluginId === plugin;
      button.toggleAttribute("aria-current", active);
      if (active) button.setAttribute("aria-current", "page");
    });
    const surface = getSurface();
    const labels = { home: L("项目首页"), goal: "Goals", sessions: "Sessions", feed: "Feed", sources: "Feed", artifacts: "Artifacts", market: L("插件市场") };
    document.querySelector("[data-immersive-plugin-title]").textContent = labels[surface] || surface;
    document.querySelector("[data-immersive-goal-tools]").hidden = surface !== "goal";
    document.querySelector("[data-feed-views]").hidden = !["feed", "sources"].includes(treePane.dataset.desktopDirectory);
    document.querySelector("[data-directory-show]").setAttribute("aria-expanded", String(!narrow() && !workspace.classList.contains("is-directory-collapsed")));
    syncPresence();
    requestAnimationFrame(revealPlugin);
  };
  const showDirectory = () => {
    setDirectoryCollapsed(false);
    if (narrow()) setMobileView("tree");
    sync();
    requestAnimationFrame(() => treePane.querySelector("[data-directory-toggle]")?.focus());
  };
  const hideDirectory = () => {
    if (narrow()) setMobileView("document");
    else setDirectoryCollapsed(true);
    sync();
    header.querySelector("[data-directory-show]")?.focus();
  };
  document.querySelector("[data-directory-show]")?.addEventListener("click", showDirectory);
  scrim?.addEventListener("click", hideDirectory);
  document.addEventListener("click", (event) => {
    if (sessionFilters?.open && !sessionFilters.contains(event.target)) sessionFilters.open = false;
  });
  strip?.addEventListener("scroll", scrollControls, { passive: true });
  if (strip) new ResizeObserver(revealPlugin).observe(strip);
  document.querySelectorAll("[data-plugin-scroll]").forEach(button => button.addEventListener("click", () => {
    strip.scrollBy({ left: (button.dataset.pluginScroll === "left" ? -1 : 1) * strip.clientWidth * .7, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }));
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-goal-work-mode]");
    if (button) {
      if (button.disabled) return;
      setWorkspaceMode("runtime");
      return;
    }
    if (event.target.closest("[data-goal-details-toggle]")) setDetails(frame.dataset.detailsOpen !== "true", true);
    if (event.target.closest("[data-operation-select], [data-artifact-select]")) {
      if (narrow()) setMobileView("document");
      sync();
    }
    if (event.target.closest("[data-immersive-theme]")) {
      const theme = document.documentElement.dataset.resolvedTheme === "dark" ? "light" : "dark";
      localStorage.setItem("goalboard:theme", theme);
      // The existing theme owner reacts to storage changes across surfaces.
      window.dispatchEvent(new StorageEvent("storage", { key: "goalboard:theme", newValue: theme }));
    }
  });
  document.addEventListener("keydown", event => {
    const tab = event.target.closest?.("[data-goal-work-mode]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = frame.querySelector('[data-goal-work-mode="terminal"]');
      next.click(); next.focus();
    }
    if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
      if (sessionFilters?.open) { event.preventDefault(); sessionFilters.open = false; sessionFilters.querySelector("summary").focus(); return; }
      if (workspace.classList.contains("is-directory-drawer-open")) { event.preventDefault(); hideDirectory(); }
    }
    if (event.key === "Tab" && workspace.classList.contains("is-directory-drawer-open")) {
      const controls = [...treePane.querySelectorAll('button:not([disabled]), a[href], input, summary, [tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest("[hidden], [inert]"));
      const next = event.shiftKey ? controls.at(-1) : controls[0];
      if ((event.shiftKey && document.activeElement === controls[0]) || (!event.shiftKey && document.activeElement === controls.at(-1))) { event.preventDefault(); next?.focus(); }
    }
  });
  if (frame) new ResizeObserver(() => {
    const saved = modes[getSelected()] || {};
    if (saved.details == null) setDetails(frame.clientWidth >= 840);
    else syncPresence();
  }).observe(frame);
  document.addEventListener("goalboard:goal-document-loaded", () => syncGoalMode(workspace.dataset.workspaceMode));
  document.addEventListener("goalboard:goal-panel-presence", syncPresence);
  window.addEventListener("resize", sync);
  return { sync, syncPresence, syncGoalMode, hideDirectory, showDirectory };
}`;
