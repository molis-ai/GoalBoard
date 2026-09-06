# 运行时协议：核心概念、Goal Contract 与工作流

## 核心概念

| 概念 | 一句话说明 |
| --- | --- |
| Goal | 一个有验收条件的目标；叶子 Goal 直接执行，复合 Goal 由子目标共同交付 |
| Goal Tree | 用户确认后的目标拆解结构，Plan 和看板都是它的派生视图 |
| 依赖 | 已确认的前置关系，是领取和完成的硬门禁 |
| Risk | 可能阻碍领取或完成的风险，需要人决定处理方式 |
| Claim | Runtime 对某个 Goal 的带时限占用，不是任务分配 |
| Run | 一次执行、复核或重新验证过程 |
| Evidence | 对应验收条件的证据（测试、检查、人工确认等） |
| Review | 自检、交叉或对抗性复核，通过后才算完成 |
| Candidate | 执行中发现的新工作，只能由用户决定是否接受 |
| Rewire | 用户确认后的目标关系重排 |

普通 Runtime 只能读取、选择、认领、执行、提交提案和证据，不能自行裁决 canonical Goal；所有推断和建议在用户确认前都不是权威事实。

## Goal Contract

用户可以在当前 Runtime 提出一个粗略想法；GoalBoard Skill 用 MCP 创建只有标题的 `draft / abstract` Goal。clarifier Runtime 读取项目事实并逐步提出 Outcome、Why、非技术业务逻辑、范围、输入输出、验收、依赖、风险和 Review Policy 的补全建议；这些建议只有在用户确认后才成为 accepted Contract。

最小可执行 Goal 与 Task 是同一粒度：结果在 Goal 内闭环，并且有可观察或可量化的验收条件。例如“设计用户 Domain，并提供可测试的增删改查方法”可以是一个叶子 Goal；“把账号系统做好”仍需继续拆分。

accepted Contract 不由 Runtime 直接改写。改变同一目标的要求时，提交同一 Goal ID 的 Contract-update Proposal，经用户确认形成新版本并保留历史；独立的新结果才成为 Candidate Goal。关系变化也必须经明确确认。

## Runtime 工作流

协议的唯一入口是 MCP 工具，不是 Web route 或内部类。工具名、输入 schema 和展示属于 `apps/mcp`；Goals/Execution/Governance 事实类型属于各自公开 Contract，跨模块操作由官方 Goals Plugin 公开、Local Host 注册。Skill 不导入这些源码，也不重新实现资格、幂等或完成算法。规划方法通过 `planning_methods` 读取；方法正文由 Goals Module 发布，Skill 的安装兼容链接不是第二份资产。

用户调用 Skill 后先做只读 context resolve。同一 Session 的已确认绑定，或恰好一个已验证 workspace membership，可以返回 bound 并恢复；目录名、普通候选或模型猜测不授权绑定。suggested/unbound 时复用当前用户对唯一项目的明确选择，否则询问。普通绑定不保存目录默认；新建、切换、解绑和删除各自需要对应授权，删除仍保护有效 Claim 和未结束 Run。

Skill 的正常回复先用用户当前语言说明“我理解了什么、为什么还要确认这一点、接下来只问或做什么”，不会把 MCP 工具名和内部 ID 当作回答。新想法、已有 Draft 恢复和方向变化会显示可修改的结构化 checkpoint，明确区分用户已确认事实、可查项目事实、Runtime 假设和建议；每个实质回答先写入 dialogue turn，再继续下一问。提案就绪时用可读 Goal Tree 汇总结果、非目标、关系依赖、叶子验收、风险和确认后的状态，用户可以整份决定或点名修改条目。

项目连接明确后，当前 Runtime 再读取 `available` 和所选 Goal 的 Contract，并自己决定是否选择其中一项。GoalBoard 不返回“唯一下一份”；Claim 是带时限的占用，不是任务分配。

工具名称以下省略 `goalboard_v1_` 前缀。

```text
new idea / existing Draft:
  draft_dialogue_start / draft_dialogue_resume → 保存每次实质回答
  → planning_methods（先目录，再所选正文）
  → goal_tree_propose / read / check → 用户明确决定 → goal_tree_decide
  → 检查返回的 semantic_review 与动作，不自行改写其余 Goal

executor:
  available → contract → select_goal(action_id, action_token)
  → 实现并验证 → run_report(completed) → evidence_submit
  → Evidence 齐全后自动释放，返回 review 动作

reviewer:
  contract → select_goal(返回的 review 动作)
  → review_submit → 自动结束 Review Run、释放 Claim
  → 最后门禁通过时 completed，不追加 complete/release

revalidator:
  available → contract → select_goal(返回的 revalidate 动作)
  → 核对当前要求、依赖、Risk 与证据 → revalidate
  → 依据 transition.projection 继续

recovery:
  mcp.context_refresh_required → 只读 context_resolve
  → bound 后用原幂等键原样重试；其他状态先解决项目选择
  stale action token → 消费返回的新动作，不盲重试旧请求
  completion blocker → 处理返回的具体门禁，不重新执行已完成工作
```

`select_goal` 原子创建 Claim 与 Run；失败不留下半套进行中状态。通过公开 `action_projection` / `transition.projection` 继续，而不是根据旧内部对象重算资格。`complete`、`release`、`ready`、`claim`、`run_start` 保留管理/兼容用途，不是正常完成流程必须追加的步骤。

对于新想法，Runtime 不必让用户先打开 Web 或逐字段填写 Contract：`draft-dialogue-start` 在一个事务中创建最小 `draft / abstract` Goal、clarifier Claim 和 Run，随后当前对话每产生一次实质澄清进展就调用 `draft-dialogue-turn` 保存用户回答、当前理解、来源事实、假设和唯一下一问；Session 中断后用 `draft-dialogue-resume` 恢复。澄清完成时，当前 Runtime 用 `goal-tree-propose` 一次提交整份可确认的拆分／变更方案，并可通过 `goal-tree-read`、`goal-tree-check` 跨 Session 恢复和检查；推断和建议在用户确认前都不是 canonical Goal、关系、Risk 或 Policy。用户随后仍在当前 Runtime 对话中逐项确认、拒绝或要求修改；用户明确回答后，Runtime 调用 `goal-tree-decide` 并传入 `user_confirmed=true`、确认摘要和具体决定，GoalBoard 再结合宿主 Session 元数据记录审计来源。这是本地对话来源记录，不伪装成密码学身份认证。已确认的安全条目才会物化，过期、悬空或循环条目会保持冲突，不影响其他已确认条目。

物化后不增加第二套“是否澄清完成”状态：确认的复合父 Goal 有子项时显示“已澄清，等待子 Goal”，确认的最小叶子显示“待执行”，仍是 Draft／开放拆分的分支才显示“待澄清”。

普通 Runtime 不能自行裁决 canonical Goal、accepted Contract 或关系。它可以通过统一 Goal Tree 决定入口承载用户在当前对话中明确给出的决定，不能伪造用户身份。执行中独立新工作用 Candidate；同一目标要求变化用同 ID Contract revision Proposal；依赖变化用显式关系提案。
