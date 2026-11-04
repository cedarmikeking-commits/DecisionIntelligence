# 职业教育专业智能决策系统

项目已升级为可独立部署的三层架构：

- 前端：React 19 + TypeScript + Vite + ECharts
- 后端：Node.js + Express 5 + TypeScript
- 数据库：PostgreSQL 16，使用版本化迁移和种子数据

## 架构

```text
Browser / React (:3000)
        │  /api（JWT）
        ▼
Express API (:8080)
        ├─ pg / transaction ─► PostgreSQL (:55432)
        └─ 职业仓适配层 ───► HRTiger API
```

核心链路（登录、组织架构、专业目录、专业负责人授权、负责人工作台）优先使用后端 API。API 未启动时，前端保留 `sql.js` 演示降级；正式环境应始终启动 API，并逐步移除演示降级。

## 本地启动

环境要求：Node.js 22+、Docker Desktop。

```bash
npm install
npm --prefix server install
cp server/.env.example server/.env
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev:full
```

访问地址：

- 前端：http://localhost:3000
- API 健康检查：http://localhost:8080/api/health
- PostgreSQL：`127.0.0.1:55432`

登录页演示账号密码均为 `123456`：机构负责人 `admin`、专业负责人 `zy`。

## 常用命令

```bash
npm run dev:web       # 仅前端
npm run dev:api       # 仅后端
npm run dev:full      # 前后端同时启动
npm run build:all     # 前后端生产构建
npm run db:migrate    # 执行增量迁移
npm run db:seed       # 导入学校、学院、42 个专业及演示账号
docker compose down   # 停止数据库，数据卷保留
```

## 后端模块

后端位于 `server/`：

- `src/app.ts`：REST API、参数校验、角色权限和错误处理
- `src/auth.ts`：JWT 签发与鉴权中间件
- `src/db.ts`：PostgreSQL 连接池和事务封装
- `migrations/`：版本化数据库结构
- `src/seed.ts`：可重复执行的初始化数据

主要 API 包括登录、二级学院、专业目录、专业负责人、学校工作台和职业仓。职业仓通过后端适配 HRTiger：

- `GET /api/career-warehouse/majors/:majorCode/careers`：按当前专业名查询，再按学校专业代码精确过滤职业。
- `GET /api/career-warehouse/careers/:careerCode/jobs`：按职业获取典型岗位、薪资、任务、知识技能、通用能力和发展路径。

上游地址由 `HRTIGER_API_BASE` 配置，请求超时由 `HRTIGER_TIMEOUT_MS` 配置；后端对上游结果做 30 分钟内存缓存。

## 数据与安全

- 密码使用 bcrypt 哈希，不保存明文。
- API 使用 8 小时有效期 JWT，并按角色授权。
- 组织、专业、用户和授权表包含约束与索引。
- 多表写入使用事务，管理操作写入 `audit_logs`。
- `.env` 和本地密钥已排除版本控制；生产环境必须更换密钥和数据库密码。

## 后续领域迁移

当前已完成核心管理链路和职业岗位主链路服务化。原有产业、培养方案等大体量演示数据仍由前端本地数据模块提供，后续按产业数据、培养方案和报告文件等领域逐步迁移。
