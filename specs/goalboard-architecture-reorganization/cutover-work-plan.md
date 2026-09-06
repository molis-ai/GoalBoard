# 最终切换执行记录

沿用已接受Cutover Contract和总spec §24。完成等级仍为全量内部完整/发布候选验证；本文件中的局部切片不代替最终验收。

## 当前切片：个人规划方法的事实所有权

问题证据：`src/projects/catalog.ts`持有个人方法表schema、CRUD和JSON解码，Web两处重复版本归一化，Web/MCP从Catalog读取方法。规划规则已经属于Goals，但个人级实现仍留在巨型Catalog，且read路径有重复SQL。

方案：Goals公开个人方法服务拥有schema、读取、保存及删除；保存复用现有normalize/version规则。Local Host只定位Home文件，调用Goals只读API；数据库驱动与只读连接生命周期留在数据owner，App不直接导入驱动。Catalog只在既有同连接迁移事务中调用Goals schema，并装配个人方法服务；所有旧个人方法wrapper和reader删除，Web/MCP切换公开owner入口。首轮边界检查纠正了Host直接导入SQLite的实现，不放宽原App禁区。

保留catalog.db位置、schema版本9/10历史、原行格式与排序、enabled/版本/时间字段、个人/项目/builtin覆盖优先级、缺Home/旧表只读不创建、错误JSON忽略与readonly关闭。不给旧数据库制造第二份个人方法表。无新产品功能、无改现用安装或用户Home。

修改边界：modules/goals个人方法与公开入口、apps/local-host个人方法reader与依赖、旧Catalog个人方法部分、Web/MCP实际caller、相关测试与owner文档。Catalog其他职责继续后续逐项退出。

验收：当前及v8旧目录的个人方法保存/升级/重开一致；更新递增版本且保留created_at；无效scope/输入不落盘；删除后重开不可见；Home/无表读取不创建文件或表。原Web/MCP/Planning回归保持。测试使用真实临时DB和生产API，读取最终状态；不增加格式/字段存在类自证测试。

验证命令：定向Goals与Local Host包build、root tsc、planning-engine与个人方法测试、受影响Web个人方法/目录回归、package boundaries、diff check。执行后记录实际命令及结果。后续继续剩余Store/Coordinator等切片及完整用户E2E，不以本切片关Cutover。

本切片通过：两包build及root tsc；Planning16/0/0（含新版本/升级/只读不写验证）、Web2/0/0、MCP方法读取1/0/0；日志 `/private/tmp/goalboard-cutover-personal-{methods,web,mcp}.log`。最终边界48包/521源码/1617 imports/72边/0errors，清单与diff检查通过；现有118项锁文件供应链检查通过。旧Catalog个人方法SQL及reader已删除，Web两处保存统一调用Goals；未把HTTP测试称为全产品浏览器验收。

## 当前切片：澄清记录schema归属

旧Store在新建和migration8中重复定义clarification_sessions/turns，两表读写已属于Governance。将原DDL原样合并成Governance公开schema常量及migration8函数，原Store只调用；不改变列、索引、外键、约束、版本号、时钟或同连接immediate事务。所有其他迁移顺序保持。修改范围为Governance schema/公开入口、Store对应DDL与migration8、该迁移定向测试及文档。

验收：新建数据库与旧migration8均使用同一DDL；失败发生在第二张表之后时整批schema及marker回滚，重试成功后能通过正式澄清API写入/读取并重开恢复。运行已有V1新建/旧迁移与Draft Dialogue集成；新回归只验证真实DDL事务失败，不重复字段存在型断言。

通过：Governance/Draft Dialogue 6/0/0，包含真实独立进程争用与恢复及新migration8事务回滚；原V1新建/历史升级1/0/0。日志 `/private/tmp/goalboard-cutover-clarification-schema.log`、`/private/tmp/goalboard-cutover-schema-reopen.log`；Governance build/root tsc通过；边界48包/522源码/1619imports/72边/0errors。两处重复DDL及旧Store私有migration8删除，schema格式与stamp8不变。

## 下一切片：执行验收应用退出旧Store类型

Claim/Run/Evidence/Review应用位于src/v1，虽已按用例分文件，但Ports仍接受完整旧Store、ExecutionModule与GoalsModule。移入Goals Native Plugin应用owner前，将存储注入收窄为snapshot/eventCursor/appendEvent/同连接immediate函数；Execution历史查询及已验证Review收尾经Execution公开API，Evidence导致Goal失效经Goals公开Lifecycle API。错误构造由现有Host注入同一Error类型，保留instanceof/错误代码与顺序。新应用不导入旧Store/Coordinator、模块Repository或root types；真实callback到Coordinator的评价与其他业务组合仍须后续迁出，不在这一步宣称整个Coordinator已退出。

验收覆盖领取竞争/租约/重复请求、Run报告、Evidence/correction、Runtime/Human Review与自动释放、跨入口相同结果及恢复；原公共行为、事件排序、事务、幂等不变。允许修改原执行验收应用及对应owner包、必要公开类型/API、Coordinator装配、边界检查指向与回归；不改Policy/权限和完成规则来让测试通过。

此切片通过：Contracts、Execution、Goals、Goals Plugin build及root tsc；117项V1核心状态机与24项执行应用/Impact/模块/Proposal收尾/coverage/Dialogue回归均0fail/0skip。日志 `/private/tmp/goalboard-cutover-v1-regression.log`、`/private/tmp/goalboard-cutover-execution-application.log`。旧6个src/v1文件已删除；新Ports不导入旧Store、Coordinator、root types或Repository。边界48包/528源码/1662imports/72边/0errors，diff检查通过。原Core错误身份、拒绝/恢复、同连接事务及幂等保持；尚未完成其回调的Coordinator评价/装配退出。

## 当前切片：工作阶段与跨模块完成门禁

Coordinator中工作阶段、租约恢复、Review就绪与跨模块完成门禁迁至Goals Plugin查询owner。输入为BoardSnapshot、Goals/Evidence/Governance/Execution公开Query及现有可执行性评价回调；不接受Store/Repository。当前状态顺序（trash/archive/replaced/clarify/有效性/活跃Run/Review/完成）和错误/用户确认提示全部保留。Execution公开Query补充原latestCompletedWorkRunEventSeq，算法与事件来源不变。外部Evaluation仍在原Coordinator，下一切片再迁。

同一组工作阶段/lease/Review/coverage/并发回归及原V1全文件验证；先检查节点方法调用图再迁移，不复制成第二套状态机。

工作阶段切片通过：root tsc及Contracts/Execution/Goals Plugin构建，135项V1/coverage/执行验收/Impact/Proposal回归全部通过，无跳过。日志 `/private/tmp/goalboard-cutover-work-state.log`。边界48包/529源码/1674imports/72边/0errors。Coordinator中的阶段与完成判断实现已删除，仍保留装配与可执行性评价。

## 当前切片：可执行性判断与任务选择

将Coordinator的资格评价（角色、依赖、风险、Policy、租约、Impact）及Ready/Available/Explain组合查询迁至Goals Plugin，按资格评价与选择查询两个职责组织，共享原snapshot索引。Goals公开现有活动Policy绑定读取；Execution公开按Goal查询Claim，保留原SQL、排序与空值行为。工作阶段查询、执行命令与列表消费同一个评价实例，避免业务回调继续返回旧Coordinator。替代关系查询抽为同Plugin纯查询函数，避免评价与阶段互相依赖。

保留角色门禁、阻塞原因及排序、无Goal时Explain返回拒绝而非新异常、Available规划优先级、已完成待证据/Review与父级覆盖修订路径、Impact并行建议语义；不改变选择与领取的事务或权限。原公开Coordinator查询入口暂作无逻辑转发，待Host入口统一切换时退出。验证既有V1、planning、availability性能/状态、跨入口执行回归，检查新owner不导入旧Store/Coordinator或Repository。

资格与选择切片通过：151项V1/coverage/Planning/执行/Impact/Proposal回归、7项Goals Query/MCP呈现/Runtime完整协议回归全部0fail/0skip；日志 `/private/tmp/goalboard-cutover-eligibility.log` 和 `/private/tmp/goalboard-cutover-eligibility-queries.log`。Contracts/Execution/Goals/Plugin构建、root tsc、48包清单与边界（533源码/1707imports/73边/0errors）通过。Goals Plugin新增对既有Execution公开Impact policy的内部依赖，未新增外部包；lock仅对应workspace link。评价与工作阶段不再互相依赖或回调Coordinator业务。

## 当前切片：风险授权、Review义务与Contract读模型

剩余风险授权依赖Action projection、兼容revision、当前Evidence/Claim/Run，属于Goals Plugin跨模块应用；保持原校验顺序、历史兼容入口、用户/Runtime权限语义，注入公开Query与同一个Error工厂。Review义务由同Plugin按Goal criterion及Policy形成有限desired结构，Governance继续负责持久化reconcile。Contract读模型迁入同Plugin，并把租约到期的只读Claim/Run投影放入该读模型文件；旧入口删除，Host/Web仍可调用公开转发。无状态机或新权限变更，无新增SQL、无分包禁区放宽。

验收：原Risk动作的过期token/revision/用户接受/Runtime缓解与Evidence关联约束、Review分工/独立性/人工条件、Contract历史与过期投影保持；原V1/跨入口/查询/Runtime回归。新应用不依赖旧Coordinator、Store、root types或模块Repository。

## 下一切片：Board初始化和当前Goal事实归属

boards已由Goals Query和schema持有，旧Coordinator仍直接创建Board、设置/清除active_goal_id。将三个写入归入Goals Repository和BoardCommands，复用Goals同连接事务、原idempotency hash/operation与events格式，公开initializeBoard/setActiveGoal；生命周期完成/归档/回收站清除当前Goal直接在Goals内部完成，删除只为回调旧Coordinator而设的clear hook。旧入口暂作转发，不再持有SQL或Board业务。Execution补齐既有activeRunIds和revalidation close-out公开API，读回Run使用已校验Board ID，删除剩余Repository旁路。

验收保持Board创建/重复键/冲突/初始化失败回滚、设置当前Goal所有拒绝条件、完成/归档/垃圾箱后active清空及恢复一致性；执行重验证的事件/Claim释放与Run读回相同。原V1及Goals模块/Runtime回归，检查旧Coordinator无SQL/Repository/lifecycle实现调用。

风险/Review/读模型切片通过：124项回归全部0fail/0skip，日志 `/private/tmp/goalboard-cutover-risk-review-query.log`。Board归属切片通过：121项V1/Runtime/执行入口/Query回归及3项公开Goals Module验证，日志 `/private/tmp/goalboard-cutover-board-owner.log`、`/private/tmp/goalboard-cutover-board-module.log`。直接Module验收补强初始化事件失败原子回滚/同键重试/冲突不写、完成后指针自主清除及重开恢复。Contracts/Execution/Goals/Plugin/root类型、48包537源码/1728imports/73边/0errors、diff检查通过。

## 当前切片：SQLite连接与公共日志技术归属

旧Store仍拥有数据库驱动、连接pragma、事件/幂等记录技术SQL和三类基础DDL。连接与events/idempotency DDL及读写归packages/storage，保持原超时/WAL/FULL/外键/立即事务、序号、主键和原始payload序列化；boards DDL归Goals。Store暂组合公开Storage函数和Module schema，迁移顺序/版本/事务完全不变。此切片不实现Outbox/Exchange，不改变历史损坏JSON的读取行为、不另建第二份日志。

验收：原新建/升级/事务失败/幂等/租约与重开回归；Storage构建与边界；后续再把迁移顺序和Snapshot装配归Local Host，不能把技术提取称为Store整体退出。

Storage切片通过：126项V1/备份恢复/公开Goals/Draft Dialogue回归0fail/0skip，日志 `/private/tmp/goalboard-cutover-storage-verified.log`。首次运行发现无caller的sqliteJson旧导出仍引用已迁走helper，删除该零caller导出后重跑通过；失败日志保留。Storage/Goals构建、root tsc、48包538源码/1730imports/73边/0errors与清单通过；pnpm实际安装同步workspace依赖、118项供应链检查通过。旧Store连接/日志方法只调用Storage，boards与journal DDL已分别归owner。

## 当前切片：Feed导入回执事实与公共事件消费

旧FeedStore仍持有导入回执DDL/写入/读取、已属Feed的迁移回执读取、公共events写入。导入及迁移回执的既有类型/字段、排序与upsert归Feed公开Receipt服务，FeedStore仅组合其结果。公共事件SQL统一消费Storage的同连接Journal（保持event-ID前缀、web-user actor、payload/顺序）；Storage连接与借用连接的Journal分别管理，后者不关闭传入DB。无新增业务规则，Feed导入/重复回执/项目隔离/迁移恢复以及原events回归。

## 下一切片：迁移顺序回Local Host

迁移1–31的执行顺序属于Local Host装配，业务DDL及数据修复继续调用各Module。把旧Store的迁移组织与Feed/Sources/Signals/Attention/Listener初始化组织迁到Local Host公开入口；Storage提供有限schema版本/表列存在查询与marker写入，并保存已有opaque blob技术表DDL。保留fresh事务边界、逐版本顺序、缺表/列修复条件、29/30联合事务与所有旧时间生成位置；不新设schema版本、不压缩旧数据或重写历史。旧Store调用一个公开migrator，旧Feed迁移导出仅转发，后续统一caller再删。

验收重点为旧DB重开、迁移29失败原子回滚、30联合升级、Artifact/Dialogue/Guidance缺表重建、已应用版本不重复事件/回执。类型与跨包边界检查后运行V1、Feed升级/Contract、Goals Module、Dialogue与备份恢复回归。Host不新增业务SQL，仅组合owner schema和有限技术API。

Feed回执切片通过：11项Feed/Goals/备份恢复和10项Feed升级/Contract/Module/接收链回归0fail/0skip；日志 `/private/tmp/goalboard-cutover-feed-receipts.log`、`/private/tmp/goalboard-cutover-feed-migration.log`。Host迁移顺序切片通过：132项V1/Feed旧版及失败回滚/Goals/Dialogue/备份恢复回归0fail/0skip，`/private/tmp/goalboard-cutover-host-migrations.log`。Storage/Host构建、root tsc，48包542源码/1751imports/83边/0errors，workspace清单/diff通过。pnpm真实同步新增内部依赖，复用已通过的118项供应链结果，无新增外部库。

## 当前切片：Snapshot公开查询组合

旧Store.snapshot仍构造并调用四个Module Repository和Clarification Store，跨模块Snapshot组合属于Goals Plugin查询。新组合只消费Goals/Impact、Execution、Evidence、Governance与Clarification公开Query；Module公开只读组装工厂复用原Query实现，避免Host构造Repository。保持Board/Goal/事件游标来源、各数组排序、全量历史、migration兼容记录与lifecycle_events合并顺序；不增加第二份Snapshot缓存或schema。旧Store其它历史读取wrapper暂留到caller切换，不假报其已退出。验收为原Contract/Available/执行状态、历史迁移、Feed Goal存在与Board隔离回归。

Snapshot公开查询切片通过：123项V1/Contract/Goals Query/Feed Goal存在与旧版重开/执行入口回归0fail/0skip，日志 `/private/tmp/goalboard-cutover-snapshot-query.log`。四个Module只读工厂复用原Query实现，Goals Plugin组合完整Snapshot；Feed的两个Goals Query caller也切换工厂。模块构建/root tsc/48包543源码/1757imports/83边/0errors/diff通过。Coordinator唯一getGoal旧Store调用已改为已知Board的Goals Query。

共享链路集成检查通过：完整 `pnpm build`（48包、root清理后构建、PTY bundle）以及66项Web/Local Host/CLI-MCP一致性/Runtime/迁移E2E回归全部0fail/0skip。日志 `/private/tmp/goalboard-cutover-shared-build.log`、`/private/tmp/goalboard-cutover-shared-entry-regression.log`。这是本次共享存储链路的回归，尚不是全产品统一用户验收。

## 下一切片：Host运行时与旧SDK兼容边界

新LocalProjectDatabase组合Storage与公开Module查询；GoalProjectApplication仅装配已经迁出的业务应用及公开Module，放入Local Host。原Store/Coordinator真实内部构造caller切换新Host入口；根SDK名称暂作兼容导出，已无生产caller的历史读取wrapper不再承担正式事实来源。保留当前公开SDK可用性，兼容入口的移除条件为全部内部caller清零、旧SDK消费者迁移且发布兼容验证完成；不在这个结构切片静默删除可用SDK方法。Domain Error保留原构造和名称，由Goals Plugin公开导出，所有入口使用同一个类。构造时的业务资格判断仍归Goals Plugin/Module，Host只绑定调用。

验收：新Host可真实初始化数据库/Board、装配Runtime、跨入口执行和恢复；旧SDK测试仍通过且错误instanceof相同；新App不导入旧root、Database驱动或Repository；数据库只打开一次，Module实例与同连接事务保持；最终pack/release caller和旧入口清理仍须后续统一验证。

LocalProjectDatabase切换：123项功能回归通过；唯一失败为旧Host边界测试仍要求构造SqliteGoalBoardStore。将该断言改为新正式构造点，并把禁止Web/CLI/MCP自行构造的集合扩展到LocalProjectDatabase；定向复验1/0/0（日志 `goalboard-cutover-project-database-guard.log`），不放宽单Host规则。原失败日志 `goalboard-cutover-project-database.log`保留。新App仅导入Storage及Module/Plugin公开入口，root Store仅剩历史SDK读取方法。

Host装配前补齐：原构造器中的新增关系预检与父级覆盖闭合判断改调用Goals Planning公开方法；算法/顺序/查询事实保持。Run-start的Goal有效性检查由既有GoalEligibility执行。随后迁出剩余装配类，保持同一错误构造与公开SDK别名。

Host应用装配切换通过：185项V1/Local Host/CLI-MCP一致性/Web/Runtime/Query/迁移回归全部0fail/0skip，`/private/tmp/goalboard-cutover-host-application.log`。新关系预检/覆盖判断回Goals Planning，Run-start资格回Goals Plugin，错误类同一公开owner；Root Coordinator只10行兼容导出，Store51行SDK读取兼容，src内部正式caller全部使用新Local Host类型/实例。Contracts/Goals/Plugin/Host/root构建、48包546源码/1784imports/84边/0errors/diff通过。

## 下一切片：renderer剩余独立样式与首次使用页面

保持视觉和交互不变：独立首次使用样式原样归Design System，Goal回收站文档样式归Goals Plugin并由Workbench组合；Root renderer只消费公开样式。首次使用页面随后归Workbench renderer factory，保留完整/更新/新项目、Desktop query、i18n、控制token、Runtime检测与所有表单/客户端data属性，Root只绑定现有平台helpers。先保存现有生产输出作为迁移对照，再对同一真实输入比对完整HTML/CSS，补既有首次使用/标题栏回归；不改样式数值、文案或业务接口，也不把该切片视为新UI设计或全产品E2E。
