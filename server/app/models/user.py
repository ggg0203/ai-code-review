# -*- coding: utf-8 -*-
"""
用户表模型 - 对应数据库中的 users 表
"""
from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import enum
# Mapped: 类型标注，告诉 IDE 这个字段是什么类型
# mapped_column: 定义列的约束（长度、默认值等）

from app.core.database import Base
# 导入 ORM 基类


# ==================== 1. 用户角色枚举 ====================
class UserRole(str, enum.Enum):
    """
    用户角色枚举
    继承 str 方便 JSON 序列化
    """
    ADMIN = "admin"       # 管理员 — 所有权限
    REVIEWER = "reviewer" # 审查者 — 可以审查代码
    DEVELOPER = "developer" # 开发者 — 提交代码，被审查


# ==================== 2. 用户表模型 ====================
class User(Base):
    """
    用户表
    
    继承 Base → SQLAlchemy 会自动：
    1. 创建表名为 users（自动复数化类名）
    2. 根据字段类型自动创建对应的数据库列类型
    """
    __tablename__ = "users"  # 指定表名（不指定则自动从类名推断）

    # ===== 主键 =====
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # primary_key=True: 主键，唯一标识每条记录
    # autoincrement=True: 自动递增（1, 2, 3...）

    # ===== 基本信息 =====
    username: Mapped[str] = mapped_column(
        String(50),        # 最多 50 个字符
        unique=True,       # 不能重复
        nullable=False,    # 不能为空
        index=True          # 创建索引（加速查询）
    )

    email: Mapped[str] = mapped_column(
        String(100),
        unique=True,       # 邮箱也不能重复
        nullable=False,
        index=True
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    # 存的是哈希后的密码，不是明文！

    github_id: Mapped[int | None] = mapped_column(
        nullable=True,
        unique=True,
        default=None,
        index=True,
    )
    # GitHub OAuth 用户 ID，邮箱注册用户此字段为 None

    # ===== 用户信息 =====
    avatar_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,     # 可以为空（用户可以不设置头像）
        default=None
    )
    # str | None 表示可选字段

    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole),  # PostgreSQL 枚举类型
        default=UserRole.DEVELOPER  # 默认角色：开发者
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True       # 默认启用
    )
    # is_active = False 表示账号被禁用

    # ===== 时间戳 =====
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)  # 创建时自动填入当前时间
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)  # 更新时自动修改时间
    )
    
        # ===== 关联 =====
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="owner",
        lazy="selectin",  # 自动预加载，查询用户时连项目一起查
    )
    
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="reviewer",
        lazy="selectin",
    )

    # ===== 字符串表示（调试用） =====
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"
