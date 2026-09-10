---
name: GoalBoard Calm Desktop
description: A calm single-directory desktop workbench with project-scoped Goal tabs and a current-summary, timeline, and reader Goal surface.
colors:
  accent: "#5068b7"
  accent-strong: "#344b9b"
  accent-soft: "#e9edfb"
  app-canvas: "#f3f3f5"
  goal-canvas: "#ffffff"
  navigator: "#f1f1f3"
  ink: "#19191b"
  ink-soft: "#424247"
  muted: "#62626b"
  faint: "#66666f"
  line: "#e7e7ea"
  line-strong: "#d9d9de"
  action: "#202023"
  action-ink: "#fbfbfc"
  terminal-dark: "#101012"
  terminal-light: "#fbfbfc"
  semantic-green: "#347759"
  semantic-amber: "#936b2d"
  semantic-red: "#a64e51"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "clamp(27px, 2.25vw, 34px)"
    fontWeight: 710
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.52
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, PingFang SC, Microsoft YaHei, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  item: "6px"
  control: "8px"
  transient: "10px"
  surface: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "38px"
  button-event-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.item}"
    padding: "6px 10px"
    height: "31px"
  button-event-secondary:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-strong}"
    rounded: "{rounded.item}"
    padding: "6px 10px"
    height: "31px"
  search-field:
    backgroundColor: "{colors.goal-canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 31px"
    height: "34px"
  goal-row-selected:
    backgroundColor: "{colors.goal-canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.item}"
    padding: "5px 8px"
  goal-overview:
    backgroundColor: "{colors.navigator}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  timeline-entry-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.item}"
    padding: "9px 8px"
---

# Design System: GoalBoard Calm Desktop

## Overview

**Creative North Star: "Calm Desktop"**

GoalBoard is a high-frequency personal workbench, not a dashboard, a lightweight home screen, a stack of paper cards, or an AI chat homepage. Its desktop workspace has two stable regions: one graphite directory that owns project and work navigation, and one flexible tabbed work surface that keeps several Goals from the current project open without duplicating domain state.

The selected Goal is an Operate/Read document: a current-summary band that always reads live state, a dense time index on the left, and a paper reader on the right for the selected event, 工作规划, 目标说明, 完成要求, or a form. Hierarchy comes from deep and light versions of the same cool palette, restrained spacing, hairline structure, and clear scope—not a grid of borders or a five-tab Goal shell. The directory changes in place when the user enters Goals or the Feed Workbench. Inbox and Feed are two presets of that same Item workspace; both replace the root with a focused list and keep a visible path back.

**Key Characteristics:**

- One desktop directory instead of parallel navigation columns.
- Project-scoped, persistent Goal tabs above the main work surface.
- Selected Goal composition: current summary above an independently scrolling timeline and reader.
- Soft tonal surfaces and calibrated shadows instead of pervasive structure lines.
- Cool monochrome surfaces with a restrained cobalt focus color.
- Compact information density in navigation, with calm reading density in the selected Goal.
- Runtime application chrome follows GoalBoard; only the terminal canvas becomes a distinct execution environment.

## Colors

The palette uses cool neutrals for structure and one low-saturation cobalt for focus, links, progress, and Goal event-document operate cues. Green, amber, and red are reserved for true semantic state. Production tokens live in the visual foundation (`--page`, `--paper`, `--rail`, `--ink`, `--blue`, `--green`, `--amber`, `--red`, `--action`) and resolve in Light and Dark; the Goal event document consumes those variables and does not introduce a second palette.

### Primary

- **Cobalt Focus**: keyboard focus, progress, links, selected timeline rows, filter pressed state, owner chips, and Goal event-document primary saves.
- **Deep Cobalt**: accent text that must remain legible on pale surfaces, including secondary event buttons and 完成要求.

### Neutral

- **App Canvas**: the outer desktop and landing-page field.
- **Goal Canvas**: the primary reading, decision, settings, and event-reader surface.
- **Navigator Gray**: the Project and Goal directory surface, and the Goal current-summary band.
- **Desktop Ink**: primary titles, current-summary column copy, and actions.
- **Soft Ink**: explanations and secondary facts.
- **Faint Ink**: the light-theme floor for quiet secondary facts; `#66666f` remains 5.04:1 against the `#f1f1f3` directory rail.
- **Quiet Line**: persistent structural separators, including the timeline/reader frame.
- **Terminal Dark / Terminal Light**: curated execution-canvas palettes, independent from the surrounding Runtime application chrome.

**The One Accent Rule.** Cobalt appears for focus, links, progress, selected intent, and Goal event-document save, filter, and owner cues. It never becomes a decorative field or a general-purpose card tint. Near-black Action remains the workbench primary for Session, draft save, and other chrome.

**The Semantic Color Rule.** Green, amber, and red always describe real application state and appear with text, never as decoration. Timeline dots use green for result, cobalt for decision, and amber for problem, always with a Chinese type label beside them.

## Typography

**Display Font:** native system UI stack with Chinese-first fallbacks.

**Body Font:** the same native system stack.

**Character:** direct, compact, and platform-native. Hierarchy comes from weight and scale rather than mixing type families or adding tracked micro-labels.

### Hierarchy

- **Display** (710, 27-34px, 1.2): selected Goal titles in chrome that still use the large title scale; the Goal event document title is a compact 21px / 650 expression (20px when the reading container is ≤1100px).
- **Headline** (700, 17px, 1.35): important section statements outside the event document. Event titles in the reader are 22px / 630 (18px at ≤680px container). Reader chrome titles (工作规划 / 目标说明 / 完成要求) are 18px.
- **Title** (700, 13-14px): Project names, section labels, and settings headings. Current-summary lead is 13px / 550. Event-form labels are 12px / 550.
- **Body** (400, 13px, 1.52): explanations and document content. Event paragraphs use 13px / 1.85 and stay within 76ch.
- **Label** (650, 10-12px): tabs, metadata, compact controls, and status text. Timeline titles are 11px / 550 clamped to two lines; time, type, and author are 10px, with tabular time numerals.

**The Native Clarity Rule.** Do not introduce display fonts or monospace styling for atmosphere. Monospace remains limited to commands, identifiers, and measured values.

**The Secondary-Fact Floor.** Source, time, filter labels, and other critical secondary facts use Faint Ink or stronger and never render below 9px.

**The Chinese Reading Voice Rule.** Timeline index and event meta use Chinese type names (当前进展, 进展记录, 配置, 建立目标, 增加关系, 工作记录, 补充说明). Judgments read 报告支持, 尚未达到, or 仍无法判断. Protocol IDs, original record IDs, and criterion IDs stay secondary.

## Layout

On Desktop at 761px and above, the workspace has two regions: a single resizable directory approximately 286-334px wide, and the remaining width as the main workbench. The directory is the only persistent navigation column. A narrow resize affordance sits between the regions without becoming another visual pane.

In macOS Overlay mode, `--desktop-titlebar-height` reserves a 48px native-chrome band. The first row contains the directory toggle and right-side work tabs; the project selector and project-settings control retain their second row. Tauri keeps the native `trafficLightPosition.y = 24px` inset; the packaged window's visible traffic-light center is approximately 22 CSS px. Both sides of the first row use that same visible center, including when the directory is collapsed. Native detection runs before stylesheets load; full-page Desktop navigation and service recovery retain the desktop query. The public Desktop bootstrap reads the real Tauri fullscreen state on page load and resize: the shared leading inset is 88px in a window and 2px in fullscreen, without changing vertical alignment. A maximized window is not fullscreen. The remaining left-side titlebar space and an elastic right workbench track with a 72px minimum may drag the window; interactive controls explicitly remain no-drag.

Project and Global Settings use the same titlebar rhythm: a 48px native band aligned with the right-side title, the existing project-controls row, then one 50px scope heading in the directory. Settings and project-index topbars do not make their outer containers draggable; only plain-text context or otherwise empty spacer regions may drag the window. The directory resizer starts at grid row 2, below the titlebar band, and utility tabs stay on one line. These Overlay rules do not change ordinary Web or the Companion at 760px and below.

The titlebar contains the current project selector, its real project dropdown, and a separate project-settings control. The directory root begins immediately below it with Inbox, Goals, Sessions, Feed, 来源, Promotion, and Visual Workspace, without permanent group headings or a resident search field. Goals and Sessions stay adjacent because they are sibling project work types; 来源 and Sessions are directly enterable directory—detail workbenches. Sessions owns Runtime execution identity, readable execution history, Goal history, and the working-directory choice used to create, link, or hand off work. Connector remains the available capability behind a Source instance. Feed is the complete source-message fact stream, while Inbox only keeps references and internal matters that need intervention, with a visible reason and next step. Promotion and Visual Workspace remain reserved work surfaces and never fabricate items, counts, or working flows. Switching back to a Goal restores its event-document reading state, scroll position, open Goal tabs, and Focus or Runtime mode.

A Session detail reuses the compact metadata → title → actions → main work surface order. Runtime, Session ID, state, the two primary actions, and the visible Level 2 demo boundary stay above the work surface without becoming a separate marketing Hero. Project, current Goal, workspace, Goal history, archive, and compatibility facts live in the contextual rail. Execution content owns the flexible majority of the desktop stage while Goal history remains visible beside it; at 760px and below, the detail stacks execution before Goal context and identity. Handoff requires a current Goal and always creates a new destination Session. Narrow-screen actions provide at least 44px touch targets.

Project is the global scope selector, not one side of a Project / Sessions switch. Inside a selected project, Goals and Sessions are sibling entries in the same root directory. 工作目录 is a Session launch and relationship attribute, not a standalone workbench module: users choose it while creating, linking, handing off, or editing a Session. Entering Sessions keeps the project selector and project workbench chrome, replaces the left root with a returnable Session directory, and opens the selected work record on the right. The Session detail uses a chronological execution timeline for dialogue, tools, status, artifacts, and terminal evidence, while keeping current relations and Goal history visible. Global compatibility `/sessions` and `/workspaces` routes return to the project index; both project-prefixed compatibility routes open the Sessions directory.

Sessions inherits the existing Goal list / Goal Detail layout contract instead of defining a parallel management system. Its subdirectory uses the same compact heading, tool rhythm, row hierarchy, flat selected location, focus behavior, and pinned count footer as the Goal Tree; its detail uses the same page background, title scale, metadata/action hierarchy, related-paper work surface, and contextual rail. Working-directory selection appears only inside Session creation, linking, handoff, and relationship controls. Root entries never expose browser link underlines, and every return affordance uses a left arrow because it moves back to the project root.

Entering Goals replaces the root directory in the same column with the original Goal Tree. Parent-child expansion, status filtering, creation, list/momentum views, archive, and trash remain available through a compact heading and on-demand tools. Entering Inbox or Feed replaces it with the same Item directory: Inbox preselects `Inbox Message`, Feed preselects `Feed`, and either view may change source, disposition, search, or sort. Search and one filter trigger share a single compact row; source, status, and sorting progressively disclose in a Goal Tree-style anchored panel instead of standing native selects. Every subdirectory has a visible back action that returns to the root.

Goal Momentum replaces a selected-node radial relationship view. Its reading order is cadence → complete dependency topology → action queue. The topology uses fixed left-to-right levels: providers occupy earlier columns and consumers later columns; multiple providers stay as a DAG instead of being forced into a single-parent tree. Within each `part_of` band, alternating provider/consumer barycentric passes order nodes inside their existing levels so adjacent dependencies stay close and dense paths cross less; this ordering never changes a Goal's topology level or relationship facts. `part_of` appears as quiet dashed group bands with labels and never competes with dependency arrows. Completed nodes stay in place at lower opacity, ordinary dependency edges recede behind node content, bottlenecks use a small red state marker, and selecting a node highlights only its direct dependency paths with matching blue lines and arrowheads while synchronizing the queue and detail. The project work tabs remain in the native titlebar and the momentum surface begins below that band, just like the other work surfaces. The surface always exposes 7/30-day scope, all/unfinished scope, zoom, data-gap language, and a real Open Goal action. Dense graphs scroll in both directions under sticky level headings; narrow layouts stack cadence, topology, queue, and detail without collapsing the graph into a misleading summary.

The directory footer stays pinned to the bottom and shows the local identity and local-space state. Its Settings control always enters global settings. Project settings remain beside the project selector at the top, so project scope and device scope cannot be mistaken for one another.

The right workbench begins with project-scoped work tabs. Opening a Goal creates or reuses its tab; the current project may retain at most eight Goal tabs in local device storage. Closing an inactive tab only removes it, while closing the active tab selects an adjacent Goal and preserves at least one displayable Goal. Switching projects restores that project's own tab set. Goal selection continues to use the existing asynchronous document loading, history, write actions, and Goal-bound Runtime.

The selected Goal is `goal-event-document`, a named inline container `goal-event-read`. Reading order is title and outcome → current summary → time index | event reader. The header keeps 聚焦 / Runtime, 工作规划, 目标说明, 补充一条, and 修改草稿 only when the Goal is an untransferred draft with no event owner. The current-summary band (`data-current-summary`) shows live judgment, state pill, 已经做成, 接下来做什么 with owner or 待接续, and 风险与待决定; 完成要求 is a text control in that band. Desktop dual-pane uses a 302px index by default, 278px when the reading container is ≤1100px, and 326px when it is ≥1400px. The two panes scroll independently; the summary stays visible. Timeline rows show time, a two-line title, and type · author. Filters are 全部 / 成果 / 决定. Footer copy is 最新在前, with 查看更早记录 when a cursor exists.

When the Goal reading container is ≤680px—including a wide window whose directory and Runtime have squeezed the Goal pane—the layout becomes a reachable 时间线 ↔ 事件往返. 返回时间线 appears in the detail toolbar. The three-column grid hides; 接下来做什么 and 待接续 (or the owner) remain on one line without expand; 展开当前结果 reveals the three facts as a single column. Event forms stack helper copy above a full-width primary; inputs, selects, and textareas use 16px. Complete mobile form checks use a 390×1100 viewport; a 390×844 clip is a scrolling fragment, not the form-geometry source.

工作规划, 目标说明, and 完成要求 open in the existing right-hand reader, with one 返回所选事件 in reader chrome. Reader and form states are exclusive of each other and of the untransferred 使用事件记录继续 form, so a long reader never shares the pane with that continue form. Returning to the selected event restores the continue entry when the Goal is still untransferred. Long content scrolls inside `reader-content`; limited height applies only to surfaces that contain the event body, not Trash.

目标说明 holds 要得到什么, 为什么, 它会怎样运转, 有效决定, and 范围 (范围内, 范围外, 必须遵守, 需要的输入, 承诺的输出), plus bound-material facts and the existing 关联与约束 deck (Goal 关系 / 风险 / 影响范围 / 工作规则). Untransferred drafts may edit through the existing draft editor in this reader; event-owned Goals change agreement through 工作规划 → 修改当前约定. 完成要求 lists current event requirements as the live authority, then read-only 原 Goal 标准 details (statement, 通过条件, 标准编号, 判断方式, 目标值, 所需证据) and exact Artifact versions. Original criteria never become a second completion algorithm.

Project Settings and Global Settings reuse the same single-directory / work-surface language. Project Settings contains the current project's Work Rules and Work Planning; Global Settings contains device-level Appearance & Language, AI & Execution Tools, and Diagnostics. Headers, directory labels, close/return behavior, and explanatory copy state the active scope.

At 760px and below, the workspace has four levels: 目录 / 当前列表（Goals、Item 或 Sessions）/ 详情 / 运行. Only the current directory panel is visible. 目录 returns to the root; entering a list-first workbench lands on its list, and only selecting a record advances to its detail. Ordinary browser Web and Desktop render the same single-directory DOM; only native traffic-light spacing, drag regions, and Tauri abilities differ. Companion Goal navigation is 目录 / 目标 / 聚焦 / 运行.

**The One Directory Rule.** The root modules, Goal Tree, Feed Item list, Sessions, and settings navigation all use one left directory; project context belongs to the titlebar. Goals, the Feed Workbench, and Sessions replace the root only while active, and their back action restores it. Working-directory choice stays inside Session actions rather than becoming another root module. Never add a second persistent navigation column.

**The Project Tabs Rule.** Work tabs belong to one project, reuse existing Goals, persist locally, and never become a second source of Goal truth.

**The Native Chrome Safe-Zone Rule.** In macOS Overlay mode, reserve the 48px titlebar band and calibrate native traffic-light inset against the visible center of the left project controls in a real packaged window. Collapsing the directory preserves that same inset before the reveal control and expands the collapsed rail just enough to contain it; work tabs begin after the rail. Only empty or plain-text titlebar regions may drag; tabs, buttons, interactive containers, and the resizer never overlap the traffic lights or inherit drag behavior. The directory and work surface separate through a quiet tonal shift, never a full-height border or standing shadow; the resize gutter only appears on interaction.

**The Compact State Tag Rule.** A Goal state is one visual tag. Directory layout wrappers may place the tag but never draw a second border or background around it, including under compact-density overrides.

**The First-Viewport Rule.** The desktop Goal screen must show the current-summary band and the timeline/reader split in its first viewport. Large empty hero space, a lightweight home composition, or a chat-first opening fails this rule.

**The Current-Summary Rule.** The top band reads `readState` (owner, work_status, agreement, progress_summary, requirements.currently_satisfied, concerns, pending and current decisions, closure, gaps). The UI displays that snapshot; it does not recompute completion. Selecting a history row never rewrites 已经做成, 接下来做什么, or 风险与待决定.

**The Container-Width Rule.** Timeline versus reader follows `@container goal-event-read`, not window width. A squeezed Goal pane at ≤680px is a single-column 时间线 ↔ 事件 path even when the window is wide.

**The Reader Mutex Rule.** 工作规划, 目标说明, 完成要求, and event forms share the right pane one at a time. Opening any of them hides the continue form; 返回所选事件 restores the selected event and, for untransferred Goals, the explicit 使用事件记录继续 entry.

## Elevation & Depth

The system uses shallow, persistent layering. The single directory and workbench separate through a quiet tonal shift without a standing divider shadow. In Light, compact location and selection states stay flat: directory rows and segmented controls use tonal fills, while tab-like navigation uses a short cobalt bottom marker. The Goal event document uses a Navigator Gray summary band, a one-pixel paper frame around timeline and reader, and a cobalt-soft selected row—no container shadow on that document. Contract-like panels outside this document, menus, and dialogs may still use low diffuse shadows. Dark keeps the same hierarchy with theme-appropriate shadow color and Dark paper (`#1b1b1e` on `#121214`); the event document must not paint a Light white sheet in Dark.

**The Soft Layer Rule.** Use a low shadow to separate one meaningful navigation or content level, not to make every row float.

**The Flat Location Rule.** In Light, a control that only answers “where am I?” never uses a paper fill plus exterior shadow. Use stronger text with either one quiet tonal fill or a two-pixel bottom marker; reserve elevation for content and overlays.

**The Line Rationing Rule.** A border must explain state, grouping, or interaction. Do not outline every item or split the entire workspace into a management-grid skeleton.

## Shapes

Compact controls use 6-8px corners. The project selector, directory items, selected work tabs, and settings navigation use approximately 9-11px corners; larger reading panels outside the event document may use 14px corners. The Goal event layout frame is 9px, the current-summary band 8px, timeline rows and event buttons 6px, and event-form fields 5px. The two structural regions remain rectangular, while the interactive and reading surfaces inside them are softly rounded. Timeline markers are 6px circles on a one-pixel rail, not capsules.

Goal state is always a compact bounded tag: 5–6px corners, a one-pixel semantic border, a quiet semantic tint, a Lucide icon, and readable text. Tags are labels rather than pills; they never use a full-radius capsule and never rely on color alone.

Relationship records use one stable reading grid: bounded relation type, leading Goal title with quiet ID/path/reason text, compact lifecycle state, then the secondary action. The metadata remains ordinary text—not a stack of full-width chips—and every repeated row shares the same title, state, and action columns. At the narrowest content width the action moves below without changing semantic order.

## Components

### Buttons

- **Workbench primary:** near-black fill in Light, near-white fill in Dark, 8px corners, 34-38px height, short stable one-line label. Session “加载原 Session” and untransferred 保存草稿修改 keep this Action fill.
- **Goal event primary:** cobalt fill, white label, 6px corners, 31px height. Used for 登记到当前 Goal, 记录到进展, 保存约定, 提交收尾, and other event-document saves.
- **Goal event secondary:** cobalt-soft fill, deep-cobalt text, no persistent outline. Used for 工作规划, 目标说明, 记录, and sibling operate entries.
- **Ghost / text:** transparent at rest; event text buttons (完成要求, 返回所选事件, 返回时间线, 返回工作规划) use deep cobalt without a chrome fill.
- **Hover:** a small opacity change and one-pixel upward translation on Action primaries; event buttons keep the same compact geometry.
- **Focus:** a two-pixel cobalt outline with a two-pixel offset.
- Dynamic Goal titles belong in surrounding copy, `title`, and accessible names, never in the visible button.

### Inputs / Fields

- **Style:** white or dark-canvas fill, one-pixel structural border, 5-8px corners, no inset shadow. Event-form fields use 5px corners and 8px 9px padding.
- **Focus:** cobalt outline independent of the border so keyboard focus remains obvious.
- **Placeholder:** visibly secondary but still readable.
- **Mobile event forms:** 16px input text; helper copy stacks above a full-width primary. Type editors show 字段名, then 内容形式 / 必填 / 移除; IDs are hidden tokens. Empty-field submit is blocked in the client.
- **Error / conflict:** field errors sit on the control; version conflict uses a quiet red-soft panel and keeps the user’s input for an explicit retry against the current versions.

### Navigation

- The Desktop titlebar begins with project selection and project settings; the directory below changes in place between root, Goals, and the Feed Item list, and ends with the pinned local identity / global-settings entry.
- The root order is Inbox, Goals, Sessions, Feed, 来源, Promotion, and Visual Workspace. It has no permanent group labels or search bar; Goals and Sessions stay adjacent as sibling project work types, while 来源 and Sessions are direct directory—detail workbenches. Working-directory choice lives inside Session actions.
- Inbox and Feed open the same Feed Workbench. Inbox presets `Inbox Message`; Feed presets `Feed`. Entering either replaces the root directory with the Item list, and Back restores the root.
- Goal decisions and recent decision results appear as labeled `Inbox Message` rows. A pending decision opens the existing real form in the detail surface; a result opens its authoritative event record and Goal links.
- Promotion and Visual Workspace remain reserved locations. Their empty states explain that entities and workflows must be defined before real content appears.
- Goals opens the existing Goal Tree in the same directory. Its heading owns the back action and compact tools; the tree retains its real hierarchy and state.
- In Light, selected directory items use a quiet flat tone and stronger text; hover uses a lighter transient tone. Neither state lifts above the directory. Dark may use its theme-appropriate paper tone without changing dimensions.
- In ordinary Web, the same compact project selector, single directory, project tabs, and work surfaces remain in place; responsive CSS folds Goals into Companion navigation and Feed into Item / Detail switching below 760px.
- Goal titles, child progress, dependency health, and status tags form four distinct reading levels; no metadata uses an inaccessible faint tone.
- Compact parent progress uses a short accessible line instead of another text badge.

**The Directory Ledger Rule.** Goals, Inbox, Feed, and 来源 share one row grammar: one leading hierarchy/type position, one flexible content column, and one stable trailing state column. The title owns the first line; identifiers, progress, source, time, and dependency health share a compact secondary line. Resting rows keep stable heights and column lines; selected, hovered, and focused rows keep identical dimensions. In Light, the selected row is a flat cobalt-neutral tint without exterior shadow. Goal rows use a 40px resting rhythm, and dependency detail adds height only after explicit expansion.

**The Source-in-Context Rule.** Inbox and Feed rows always retain a visible source fact, even when the Item comes from GoalBoard itself. The 来源 workbench uses the same title, secondary-fact, and trailing-state hierarchy; its detail owns overview, configuration, pull schedule, source messages, and run state. Adding a source, binding an account, or migrating Relay may use a focused dialog, but browsing and managing an existing Source never depends on that dialog. Connector remains the capability and Source remains the configured instance.

**The Attention Boundary Rule.** Feed is complete and append-oriented; Inbox is selective and action-oriented. An Inbox row must say why it needs intervention, which Feed Item, Source, or Goal it references, and what the next real step is. Completing it removes it from the default Inbox without deleting or copying the referenced object.

### Feed Workbench

The Feed Item directory keeps its tools above the list: one search field, then type, source, disposition, and sort controls. Inbox and Feed change the initial type and handling language, not the underlying workspace: Inbox offers Archive / Restore to Inbox, while Feed offers Ignore / Restore to Feed. Filters and status labels always follow the active type. Each row keeps type, source, title, summary, time, and readable state compact enough to scan; an empty result reports the filtered count and offers a direct reset.

The right surface is dedicated to the selected Item. It shows type and disposition labels, source and author, timestamp, summary or body, tags, original link, and attached materials. Actions remain beside the Item: save as material, promote to Goal, start processing, ignore, restore, or open the already linked Goal. Missing body, link, or materials use honest empty states.

来源、Feed 与 Inbox 的详情共享 Goal Detail 的工作面层级，但不共享同一内容顺序：来源使用身份页头 → 紧凑分段导航 → 单一配置工作面；Feed 使用单一 paper 阅读面并让标题、摘要和正文优先；Inbox 在同一工作面中把现有操作和“下一步”置于进入原因、关联对象与原消息正文之前。详情容器使用相关 paper 色、14px 圆角和低阴影，内部以分隔行组织，不为去向、事实或资料再套卡片。目录选择仍遵守 Flat Location Rule，只用平面色调，不使用外部阴影。

Relay ownership migration is a user-confirmed local operation. Its dialog previews Source, Item, and Material counts, keeps Relay read-only, and explains that GoalBoard takes over every usable Feed asset: source definitions, Items, Materials, cursors, run history, decryptable GitHub/Gmail credentials, and retained encrypted bodies. Secrets and bodies are re-sealed into GoalBoard-owned stores; the interface must never expose token values or imply that ongoing synchronization still depends on Relay. Source and Relay dialogs belong to the workspace overlay layer, so the active work surface or narrow Item-list mode cannot hide them; below 760px they remain contained inside the viewport. The source manager is the durable control surface for adding public feeds, connecting GitHub/Gmail accounts, reading status and failures, and manually synchronizing, pausing, or resuming each source.

Promote and Start create or reuse one Draft Goal and bind the Item as its input. Start moves into that Goal's Runtime. If no TUI is open, the Runtime picker stays visible; after the user chooses one, source, body, and material context is filled into the terminal without being sent. All source-derived content stays inside a visible untrusted-data boundary and terminal control characters cannot become input actions. This preserves Goal ownership and gives the user a final review point.

### Project Goal Tabs

- Tabs are isolated by project, restored from local device storage, and capped at eight.
- Opening the same Goal focuses its existing tab. Opening a ninth Goal retires an older inactive tab rather than overflowing indefinitely.
- In Light, work tabs stay flat inside the workbench bar: the selected tab uses stronger text and a two-pixel bottom marker rather than a white fill or exterior shadow, while inactive hover uses only a faint transient tone. Dark keeps its theme-appropriate paper surface; status remains readable through its dot and the Goal content itself.
- The close action is separate from the tab button. Closing the active tab selects a neighbor and never removes the last displayable Goal.
- The tab strip uses complete tab semantics and disappears in the narrow Companion.

### Native Window Chrome

- First-run and update Onboarding use a compact 44px native-only topbar with an 88px leading safe area and a 1px optical lift. In the packaged macOS App, the brand and right-side actions align with the visible traffic-light center. Both pages reuse the Desktop bootstrap before styles load; ordinary browser/mobile topbars keep their existing dimensions. Do not move the system buttons to compensate for page layout.
- macOS Overlay uses a fixed 48px titlebar band, with the directory toggle and right-side tabs/titles centered at approximately `y=22px`. Project controls retain their existing second row. The shared native inset follows actual fullscreen state (88px window / 2px fullscreen), including full-page navigation; never infer it from viewport width.
- The workbench bar contains tabs, one dedicated empty 48px drag slot, and actions. Utility tabs stay on one line.
- Whole workbench, project-index, and Settings topbars are never drag regions. Only empty spacers or plain-text context may carry window drag behavior.
- The directory resizer begins below the native titlebar at grid row 2 so resizing and macOS traffic-light interaction never compete.
- Ordinary Web and the Companion at 760px and below retain their existing chrome and structure.

### Goal Event Document

The selected Goal is the main work document. Compact header reading order is status tag and facts → title → outcome sentence → 聚焦 / Runtime and short operate controls. The outcome sentence is muted 12px and does not replace the current-summary lead. 工作规划 and 目标说明 sit in the header; 完成要求 sits in the summary tools; 补充一条 is the ordinary add path. Commitment, authorization, or completion-requirement changes use event forms or a trusted decision, not a page-wide quick-record.

The current-summary lead is a judgment sentence from `progress_summary` or the matching owner/work_status copy (仍按原来源阅读, 需要你决定, 部分受阻, 正在推进, 已有完成结论, 已取消). Column copy is Ink. Next and risk must be distinct facts; owner or 待接续 stays in the next column (and on the collapsed next line). Green/amber pills name 进行中, 受阻, 待决定, 已完成, 未转交, 已取消 with text.

The time index is latest-first, grouped by ISO day (`YYYY-MM-DD`), with 54px resting rows (56px at ≤680px). Click, keyboard up/down, and 上一条 / 下一条 move the selected event. The right pane shows that event’s original fields, or a reader/form. Empty values say 未填写. Ordinary text is escaped. History Run / Evidence / Review / Decision keep original IDs and sources; mapped items use Chinese type labels, and unmapped items stay neutral records.

关联与约束 inside 目标说明 keeps the existing two-layer section deck: equal-width summary cards in a stable selector row, unabridged titles, one full-width stage beneath. That deck is a nested work area, not the Goal document’s primary navigation. Deep links that target a risk or relation open 目标说明 and then the matching factor stage.

### Runtime

Runtime has two explicit layers. Goal-page work mode remains 聚焦 / Runtime. The owner header, tabs, parent-Goal guidance, child choices, and action controls are GoalBoard application UI, so they use Goal Canvas, Navigator Gray, normal Ink, Muted, and Line tokens in Light and Dark. Parent-Goal guidance and child choices remain flat rows separated by lines, not nested warning cards.

Event-owned Goals, including parent Goals that record their own integration, keep the executable Runtime surface. Switching Goal does not rebind an already open terminal and never auto-sends. Untransferred `closed_compound` Goals without event ownership still use the parent-read-only terminal guard: add/open controls stay disabled on that Goal, and the user enters a child Goal to execute. Child-count is not a completion algorithm, and the event document does not hide Runtime because a parent is compound.

Only the bounded terminal canvas uses terminal tokens. The local terminal appearance preference offers Follow interface, Light, and Dark. It is applied before first paint and updates live xterm background, foreground, cursor, selection, and ANSI colors without reloading. Terminal Dark uses `#101012`, `#f0f0f2`, `#b5b5bd`, and `#92929b`; Terminal Light uses `#fbfbfc`, `#202023`, `#65656e`, and `#7b7b84`.

### Settings

Desktop settings reuse the same single directory, local-identity footer, flat Light current-location treatment, and soft content section panels as the Goal workspace. Project Settings is reached beside the project selector and only contains Work Rules and Work Planning for that project. Global Settings is reached from the pinned footer and only contains Appearance & Language, AI & Execution Tools, and Diagnostics for the current device. Ordinary Web settings retain their existing shell.

## Do's and Don'ts

### Do:

- **Do** establish hierarchy with proportion, alignment, and whitespace before adding a container.
- **Do** keep project, module, Goal Tree, and settings navigation in one replaceable directory.
- **Do** preserve project-local Goal tabs as UI state, never canonical Goal state.
- **Do** reserve the 48px macOS Overlay safe zone and limit window dragging to empty or plain-text titlebar regions.
- **Do** distinguish project settings from global device settings at their entry, directory, header, and content.
- **Do** use tonal surfaces and low shadows to reduce the need for structure lines.
- **Do** use the first viewport for current summary plus timeline/reader, not a decorative hero.
- **Do** keep one selected Goal visually continuous across Navigator, Focus, and Runtime.
- **Do** keep the current-summary band on live `readState` while history selection only changes the reader.
- **Do** size timeline versus reader from the Goal reading container, including when Runtime is open.
- **Do** keep 工作规划 / 目标说明 / 完成要求 in the right-hand reader with one 返回所选事件.
- **Do** preserve the cool-neutral palette and reserve cobalt for interaction, focus, and event-document operate cues.
- **Do** keep Promotion and Visual Workspace visibly labeled “规划中” and limited to honest reserved views until their real entities and flows exist.
- **Do** test Light, Dark, Standard, Compact, Runtime-open, narrow states, and both terminal palettes together.
- **Do** keep every mobile workspace surface full width and free of horizontal viewport escapes.
- **Do** let users scan 关联与约束 summaries before expanding one body, and reveal the correct card before honoring a deep link.

### Don't:

- **Don't** add a second persistent navigation column or repeat project context across the shell.
- **Don't** restore permanent search, group headings, and tool blocks at the root directory.
- **Do** keep the existing Goal search usable inside the Goals drill-down. GW5 restored the search field above its compact toolbar after real browser tests found it hidden by desktop CSS; this does not add search to the root directory or change the visual direction. Desktop and 390px captures were inspected; details and evidence are in `specs/goalboard-architecture-reorganization/gw5-progress.md`.
- **Don't** let open Goal tabs grow without limit or leak across projects.
- **Don't** place tabs, buttons, or the directory resizer in the traffic-light safe zone, or mark an interactive topbar container as draggable.
- **Don't** use a lightweight home screen with large empty regions where current Goal facts and work should be.
- **Don't** present reserved placeholder views as working modules or fill them with fake content, counts, or activity.
- **Don't** treat the Goal Tree or an AI chat homepage as the entire application.
- **Don't** restore five Goal tabs (概览 / 完成要求 / 进展与阻塞 / 关联与约束 / 完整记录) as the selected Goal’s primary navigation.
- **Don't** let 目标说明 or 完成要求 share the reader with 使用事件记录继续.
- **Don't** treat 原 Goal 标准 as the live completion authority; current requirements and `readState` own that reading.
- **Don't** use protocol identifiers (`report`, `goal.created`, English verdicts) as the primary timeline or event explanation.
- **Don't** blur project-setting and global-setting scope.
- **Do** treat an explicit “加入组合” click as the project-adoption confirmation and send it to the existing guarded API. GW5 repaired the missing client field; it did not weaken the server check or auto-adopt methods. Real failed/retried saves, independent personal/project versions and desktop/390px captures were verified; no visual redesign was made (impeccable harden).
- **Don't** force the Desktop two-pane arrangement into the narrow Companion; Feed must switch between Item and Detail.
- **Don't** turn unrelated filters and navigation into segmented pills; grouped selection surfaces are reserved for compact Goal mode and Runtime switches.
- **Don't** stack unrelated detail sections into one unbroken page or give every nested content block another decorative border.
- **Don't** make status colors decorative or rely on color without text.
- **Don't** copy YouMind's product IA, content cards, branding, or imagery.
