# -*- coding: utf-8 -*-
"""
代码审查记录表模型
"""
from sqlalchemy import String, Text, Integer, Float, ForeignKey, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
import enum

from app.core.database import Base


class ReviewStatus(str, enum.Enum):
    """审查状态"""
    PENDING = "pending"        # 等待审查
    REVIEWING = "reviewing"    # AI 审查中
    COMPLETED = "completed"    # 审查完成
    APPROVED = "approved"      # 人工确认通过
    REJECTED = "rejected"      # 人工拒绝


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # ===== PR 信息 =====
    pr_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # GitHub PR 编号

    pr_title: Mapped[str] = mapped_column(String(200), nullable=False)
    # PR 标题

    branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 分支名，如 feature/ai-review

    # ===== 代码内容 =====
    files_changed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 修改文件数

    code_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    # 待审查的代码片段（支持 AI 分析时使用）

    # ===== AI 审查结果 =====
    ai_result: Mapped[str | None] = mapped_column(Text, nullable=True)
    # AI 审查建议（Markdown 格式）

    ai_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    # AI 评分（0-100）

    # ===== 状态 =====
    status: Mapped[ReviewStatus] = mapped_column(
        SAEnum(ReviewStatus),
        default=ReviewStatus.PENDING,
    )

    # ===== 关联 =====
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id"),
        nullable=False,
    )
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="reviews",
    )

    reviewer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )
    reviewer: Mapped["User"] = relationship(
        "User",
        back_populates="reviews",
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

    def __repr__(self):
        return f"<Review(id={self.id}, pr='{self.pr_title}', status='{self.status}')>"
