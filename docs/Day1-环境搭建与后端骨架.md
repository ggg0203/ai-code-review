# Day 1 — 环境搭建与后端骨架

> 日期：2026-05-29  
> 项目：AI 智能代码审查与项目管理平台

---

## ✅ 今日完成

### 1. Docker 环境
- 安装 Docker Desktop，解决启动失败问题（`com.docker.service` 手动启动）
- 配置阿里云镜像加速器 `https://uqajg94u.mirror.aliyuncs.com`
- 创建 `docker-compose.yml`，启动三个服务：

| 服务 | 镜像 | 端口 | 用途 |
|------|------|------|------|
| PostgreSQL | `postgres:16-alpine` | 5432 | 业务数据存储 |
| Redis | `redis:7-alpine` | 6379 | 缓存 + Session |
| Qdrant | `qdrant/qdrant:latest` | 6333 | 向量数据库（RAG） |

### 2. 项目结构
```
ai-code-review/
├── apps/           # 前端应用（web/mobile/screen，待实现）
├── server/         # FastAPI 后端
│   ├── app/
│   │   ├── core/       # 配置 + 数据库连接
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   ├── models/     # 数据表模型
│   │   │   └── user.py
│   │   └── api/        # API 路由（待实现）
│   ├── .env            # 敏感配置（不入库）
│   ├── .gitignore
│   ├── main.py         # 入口文件
│   └── requirements.txt
├── docker/         # Docker 配置
│   └── docker-compose.yml
├── docs/           # 文档
└── packages/       # 共享包（待实现）
```

### 3. FastAPI 后端
- `main.py` — 服务入口，含 `/` 和 `/health` 接口
- `app/core/config.py` — `.env` 配置管理（pydantic-settings）
- `app/core/database.py` — SQLAlchemy 异步引擎 + 会话工厂
- `app/models/user.py` — 用户表模型（id/username/email/password/role）
- Swagger 文档页面 `http://localhost:8000/docs` 正常运行

### 4. Python 依赖
```txt
fastapi, uvicorn, sqlalchemy, psycopg[binary], redis,
python-jose, passlib, pydantic, pydantic-settings,
python-multipart, httpx
```

---

## 🔑 关键经验

| 问题 | 解决方案 |
|------|---------|
| Docker Desktop 启动失败 | 管理员 PowerShell：`Start-Service com.docker.service` |
| Docker Hub 下载超时 | 配置阿里云镜像加速器 |
| pydantic/asyncpg 编译失败 | 删除显式版本，用 fastapi 自动安装；asyncpg → psycopg[binary] |
| Python 3.13 缺少预编译 wheel | 降级包版本或换替代品 |

---

## 📋 明天计划

1. 修改 `main.py`，启动时自动创建数据库表
2. 创建用户注册/登录 API
3. 实现 JWT 双 Token 认证（Access Token + Refresh Token）
4. 实现 RBAC 权限中间件
5. 测试整个认证流程
