# -*- coding: utf-8 -*-
"""
公开统计 API — 供 3D 大屏使用，无需登录
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import async_session
from app.core.cache import cache_get, cache_set, CACHE_STATS
from app.models.project import Project, ProjectStatus
from app.models.review import Review, ReviewStatus

router = APIRouter(prefix="/api", tags=["统计"])


class StatsResponse(BaseModel):
    """平台统计数据"""
    total_projects: int          # 项目总数
    active_projects: int         # 活跃项目
    total_reviews: int           # 审查总数
    completed_reviews: int       # 已完成审查
    pending_reviews: int         # 待处理审查
    avg_score: float             # 平均 AI 评分
    languages: list[str]         # 涉及的语言列表


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """获取平台统计数据（公开接口 + Redis 缓存）"""
    # 先查缓存
    cached = await cache_get(CACHE_STATS)
    if cached is not None:
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    async with async_session() as db:
        # 项目统计
        proj_count = await db.execute(
            select(func.count()).select_from(Project)
            .where(Project.status != ProjectStatus.DELETED)
        )
        total_projects = proj_count.scalar() or 0

        active_count = await db.execute(
            select(func.count()).select_from(Project)
            .where(Project.status == ProjectStatus.ACTIVE)
        )
        active_projects = active_count.scalar() or 0

        # 审查统计
        review_count = await db.execute(
            select(func.count()).select_from(Review)
        )
        total_reviews = review_count.scalar() or 0

        completed_count = await db.execute(
            select(func.count()).select_from(Review)
            .where(Review.status == ReviewStatus.COMPLETED)
        )
        completed_reviews = completed_count.scalar() or 0

        pending_count = await db.execute(
            select(func.count()).select_from(Review)
            .where(Review.status == ReviewStatus.PENDING)
        )
        pending_reviews = pending_count.scalar() or 0

        # 平均 AI 评分
        avg_result = await db.execute(
            select(func.avg(Review.ai_score)).select_from(Review)
            .where(Review.ai_score.isnot(None))
        )
        avg_score = round(avg_result.scalar() or 0, 1)

        # 涉及语言（去重）
        lang_result = await db.execute(
            select(Project.language).select_from(Project)
            .where(Project.language.isnot(None))
            .where(Project.status != ProjectStatus.DELETED)
            .distinct()
        )
        languages = [row[0] for row in lang_result.all() if row[0]]

    stats = StatsResponse(
        total_projects=total_projects,
        active_projects=active_projects,
        total_reviews=total_reviews,
        completed_reviews=completed_reviews,
        pending_reviews=pending_reviews,
        avg_score=avg_score,
        languages=languages,
    )
    # 写入缓存
    await cache_set(CACHE_STATS, stats.model_dump())
    return JSONResponse(
        content=stats.model_dump(),
        headers={"X-Cache": "MISS"},
    )
