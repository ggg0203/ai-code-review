# -*- coding: utf-8 -*-
"""
项目表模型 - 对应数据库中的 projects 表
"""
from sqlalchemy import String, Text, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import enum

from app.core.database import Base


# ==================== 1. 项目状态枚举 ====================
class ProjectStatus(str, enum.Enum):
    ACTIVE = "active"           # 活跃
    ARCHIVED = "archived"       # 已归档
    DELETED = "deleted"         # 已删除（软删除）


# ==================== 2. 项目表 ====================
class Project(Base):
    """
    项目表
    一个用户可以创建多个项目
    """
    __tablename__ = "projects"

    # ===== 主键 =====
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # ===== 基本信息 =====
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    # 项目名称，如 "AI Code Review Platform"

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 项目描述，Text 类型可存长文本

    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # GitHub 仓库地址，如 https://github.com/user/repo

    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 主要编程语言，如 Python/JavaScript/Go

    # ===== 状态 =====
    status: Mapped[ProjectStatus] = mapped_column(
        SAEnum(ProjectStatus),
        default=ProjectStatus.ACTIVE,
    )

    # ===== 关联（外键） =====
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),  # 关联 users 表
        nullable=False,
    )
    # ForeignKey: 外键约束，保证 owner_id 必须对应一个真实存在的用户

    # SQLAlchemy relationship: 自动加载关联的 User 对象
    owner: Mapped["User"] = relationship(
        "User",  # 关联到 User 模型（用字符串避免循环导入）
        back_populates="projects",  # 在 User 模型中也有一个 projects 属性反向指向这里
    )

    # ===== 时间戳 =====
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="project",
        lazy="selectin",
    )


    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}')>"
