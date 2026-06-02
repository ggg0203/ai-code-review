# -*- coding: utf-8 -*-
"""
AI Code Review Platform - FastAPI 后端入口
负责启动 Web 服务、挂载路由、配置中间件
"""

# ========== 1. 导入依赖 ==========
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
# asynccontextmanager: 管理异步资源的生命周期（如数据库连接）

from app.core.database import engine, Base
from app.api.auth import router as auth_router

from app.models.user import User  # 必须导入，否则 SQLAlchemy 不知道 User 表存在
from app.models.project import Project  # 确保 SQLAlchemy 发现 Project 表
from app.api.projects import router as projects_router  # 导入项目相关路由，确保它们被注册

from app.models.review import Review

from app.api.reviews import router as reviews_router
from app.api.ai import router as ai_router
from app.api.rag import router as rag_router
from app.api.stats import router as stats_router
from app.ai.rag import init_collection

# ========== 2. 生命周期管理（必须在 app 创建前定义） ==========

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理
    - 启动时（yield 之前）：创建数据库表
    - 关闭时（yield 之后）：清理资源
    """
    # ===== 启动：自动创建所有表 + 迁移已存在的表 =====
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Base.metadata.create_all: 扫描所有继承 Base 的类
        # 在数据库中自动创建对应的表（已存在的表不会重复创建）

        # 增量迁移：为已有 reviews 表新增 code_snippet 列
        from sqlalchemy import text as sa_text
        result = await conn.execute(
            sa_text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='reviews' AND column_name='code_snippet'"
            )
        )
        if not result.fetchone():
            await conn.execute(sa_text("ALTER TABLE reviews ADD COLUMN code_snippet TEXT"))
            print("✅ 已迁移：reviews 表新增 code_snippet 列")
    print("✅ 数据库表创建/迁移完成")

    # 初始化 Qdrant 集合
    await init_collection()
    print("✅ Qdrant 知识库初始化完成")

    yield  # ← FastAPI 服务在这期间运行

    # ===== 关闭：释放资源 =====
    await engine.dispose()
    print("✅ 数据库连接已关闭")


# ========== 3. 创建 FastAPI 应用实例 ==========
app = FastAPI(
    title="AI Code Review Platform",                    # API 文档标题
    description="AI驱动的智能代码审查与项目管理平台",    # API 文档描述
    version="1.0.0",                                    # API 版本号
    lifespan=lifespan,                                  # 生命周期管理
)


# ========== 4. 配置跨域中间件（CORS） ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # 允许所有来源访问（开发阶段用*，生产环境要限制域名）
    allow_methods=["*"],      # 允许所有 HTTP 方法（GET/POST/PUT/DELETE等）
    allow_headers=["*"],      # 允许所有请求头
)

# CORS 是什么？
# 浏览器安全策略：前端 http://localhost:5173 不能直接调后端 http://localhost:8000
# 加了 CORS 中间件，后端告诉浏览器："我允许这个请求"，前端就能正常调用了

# 注册路由
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(reviews_router)
app.include_router(ai_router)
app.include_router(rag_router)
app.include_router(stats_router)

# ========== 5. 定义路由（API 接口） ==========

@app.get("/")
async def root():
    """
    根路由 - 测试服务是否运行
    访问 http://localhost:8000/ 返回欢迎信息
    """
    return {"message": "AI Code Review Platform API is running"}

@app.get("/health")
async def health_check():
    """
    健康检查路由 - 监控服务状态
    用于 Docker/K8s 检测服务是否存活
    返回 200 表示服务正常
    """
    return {"status": "healthy"}


# ========== 6. 启动方式（命令行运行） ==========
# 开发模式：uvicorn main:app --reload --port 8000
# main:app 表示 main.py 文件里的 app 变量
# --reload 表示代码改动自动重启（开发用）
# --port 8000 指定端口
