# Evidence & Verification

本模块保留旧 Evidence、不可变 Correction、原验收引用和文件来源的历史读取，以及对应 schema 和数据库升级。旧 submit/correct、执行链验证与专属写入口已经退役。新的结果记录使用 Goals 的工作事件和当前要求判断。

原 Evidence 与 correction chain 保留其 ID、locator、作者、时间、结果、Contract revision 和 criterion 关联。历史正文、项目文件读取和快照继续使用本模块的公开查询；已有文件访问边界仍生效。可读文件不等于当前要求已经通过，历史 Review 也不会被改写成新的用户验收。

Artifact 内容和版本由 Artifacts 管理，历史 Review 由 Governance 管理，当前约定、要求及完成效果由 Goals 管理。本模块不再通过旧 Action Projection 或跨 owner 的执行收尾链决定当前 Goal 是否完成。

当前报告、人工验收和收尾用法见 [Goals](goals.md)、[Governance](governance-collaboration.md) 与 [Runtime](../runtime.md)。迁移和历史阅读使用真实历史夹具验证，不调用退役写服务重新制造旧数据。
