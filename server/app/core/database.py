# -*- coding: utf-8 -*-
"""
数据库连接 - 创建 SQLAlchemy 引擎和异步会话
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
# create_async_engine: 创建异步数据库引擎
# AsyncSession: 异步数据库会话
# async_sessionmaker: 会话工厂
# DeclarativeBase: ORM 基类，所有数据表模型继承它

from .config import settings
# 从 config.py 导入全局配置


# ==================== 1. 创建数据库引擎 ====================
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,           # 设为 True 会打印所有 SQL 语句（调试用）
    pool_size=10,         # 连接池大小（最多同时 10 个连接）
    max_overflow=20,      # 超过 pool_size 时额外允许的连接数
)

# ==================== 2. 创建会话工厂 ====================
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,  # 使用异步会话
    expire_on_commit=False, # 提交后不使对象过期
)

# ==================== 3. 创建 ORM 基类 ====================
class Base(DeclarativeBase):
    """
    所有数据表模型继承这个类
    SQLAlchemy 会自动识别所有继承 Base 的类，创建对应的表
    """
    pass


# ==================== 4. 获取数据库会话（依赖注入用） ====================
async def get_db() -> AsyncSession:
    """
    FastAPI 依赖注入函数
    每次请求自动分配一个数据库会话，请求结束自动关闭
    
    用法（在路由中）：
        @app.get("/users")
        async def get_users(db: AsyncSession = Depends(get_db)):
            result = await db.execute(...)
            return result
    """
    async with async_session() as session:
        # async with 确保：
        # 1. 请求进来时创建会话
        # 2. 请求结束时自动关闭（即使出错也会关闭）
        yield session
