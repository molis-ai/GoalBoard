# Execution

Execution 保存旧 Claim、Run、attempt 和 lease 的历史记录、查询、schema 与必要数据库升级。当前 Goal 工作通过 Goals 事件接口记录；领取、续租、启动／报告旧 Run、释放／撤销 Claim 及其专属生命周期写入口已经退役。

历史记录保留原 ID、作者、时间、状态和关联。Goal 时间线、原记录阅读和项目快照可以通过公开查询读取这些事实。项目删除仍会检查历史未结束 Claim/Run；这项现有只读保护不代表旧执行协议可以继续运行。

本模块不拥有当前 Goal 约定或完成状态，也不控制真实 Runtime Session、终端、PTY 和进程。技术进程的启动、恢复、中断和输出由 Runtime Host 与 Native Work 负责；删除旧 Run 写服务不会删除这些能力。

新的普通笔记、工作结果、进展、收尾和继续见 [Goals](goals.md) 与 [Runtime](../runtime.md)。旧数据库升级仍由 Host 装配同一连接上的 owner 迁移；历史夹具用于验证原记录可读，不能为生成测试数据而恢复生产写接口。
