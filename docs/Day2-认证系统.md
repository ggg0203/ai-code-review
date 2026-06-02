# Day 2 — 数据库连接 + 用户认证系统

> 日期：2026-05-30  
> 项目：AI Code Review Platform

---

## ✅ 今日完成

### 1. 启动时自动建表
- 修改 `main.py`，加入 `lifespan` 生命周期管理
- 服务启动时 SQLAlchemy 自动扫描模型 → 在 PostgreSQL 创建对应表
- 验证：`users` 表结构正确（9 个字段、3 个索引）

### 2. Python 虚拟环境
- 创建 `venv/` 隔离项目依赖
- 以后开发流程：`venv\Scripts\activate` → pip install → uvicorn

### 3. 密码 + JWT 安全模块
`app/core/security.py`：
- `hash_password()` / `verify_password()` — bcrypt 加密
- `create_access_token()` — 短期 Token（30分钟过期）
- `create_refresh_token()` — 长期 Token（7天过期）
- `decode_token()` — 解码验证 Token
- `get_current_user()` — 从请求提取 Token → 查数据库 → 返回用户

### 4. 认证 API
`app/api/auth.py`：

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/auth/register` | 用户注册 → 返回 Token | ✅ |
| POST | `/auth/login` | 用户登录 → 返回 Token | ✅ |
| GET | `/auth/me` | 获取当前用户信息（需 Token） | ✅ |
| POST | `/auth/refresh` | 刷新 Token | 🔜 |

### 5. JWT 认证中间件
- 无 Token 访问保护接口 → 403
- 带 Token → 自动解码 + 查库 → 注入 `current_user`

---

## 🔑 关键踩坑

| 问题 | 原因 | 解决 |
|------|------|------|
| `lifespan is not defined` | 函数定义在 `FastAPI()` 之后 | 移到前面 |
| SQLAlchemy TypeError | 2.0.30 不兼容 Python 3.13 | 升级到 2.0.36 |
| `bcrypt.__about__` 报错 | passlib 与 bcrypt 5.x 不兼容 | `pip install bcrypt==4.0.1` |
| `ModuleNotFoundError: greenlet` | 虚拟环境没装 | `pip install greenlet` |
| `ModuleNotFoundError: pydantic_settings` | requirements.txt 漏了 | 加回 |
| `/auth/me` 500 错误 | `created_at` 类型 str→datetime | Pydantic model 用 `datetime` 类型 |

---

## 📋 明天计划

1. RBAC 权限中间件（admin/reviewer/developer 三级）
2. 项目（Project）数据模型 + CRUD API
3. 代码审查记录（Review）数据模型
4. 初始化 React 管理后台（Vite + Ant Design）
