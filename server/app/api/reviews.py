# -*- coding: utf-8 -*-
"""
审查 API — 创建、查询、更新、AI 流式分析
"""
import json
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db, async_session
from app.core.cache import cache_get, cache_set, cache_delete, CACHE_REVIEWS, CACHE_STATS
from app.core.security import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.review import Review, ReviewStatus
from app.ai.reviewer import review_code_stream

# RBAC: AI 分析操作需要审查者或管理员角色
from app.core.security import require_reviewer

router = APIRouter(prefix="/reviews", tags=["审查"])


# ---- Pydantic Schema ----

class ReviewCreate(BaseModel):
    """创建审查记录请求体"""
    project_id: int
    pr_title: str
    pr_number: int | None = None
    branch: str | None = None
    files_changed: int | None = None
    code_snippet: str | None = None  # 待审查代码片段


class ReviewUpdate(BaseModel):
    """更新审查记录请求体（全部可选）"""
    ai_result: str | None = None
    ai_score: float | None = None
    status: str | None = None


class ReviewResponse(BaseModel):
    """审查记录响应体"""
    id: int
    project_id: int
    pr_title: str
    pr_number: int | None = None
    branch: str | None = None
    files_changed: int | None = None
    code_snippet: str | None = None
    ai_result: str | None = None
    ai_score: float | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---- 辅助函数 ----

def _extract_score(text: str) -> float | None:
    """从 AI 审查结果中提取综合评分（格式：综合 | **X/10**）"""
    # 匹配表格中的综合评分行
    m = re.search(r'综合.*?\*{0,2}(\d+(?:\.\d+)?)\s*/\s*10\*{0,2}', text)
    if m:
        return float(m.group(1)) * 10  # 转换为百分制
    # 备用：匹配 ## 📊 综合评分：X/100
    m = re.search(r'综合评分.*?(\d+)\s*/\s*100', text)
    if m:
        return float(m.group(1))
    return None


# ---- API 端点 ----

@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    req: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建审查记录"""
    # 检查项目是否存在
    result = await db.execute(select(Project).where(Project.id == req.project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="项目不存在")

    review = Review(
        project_id=req.project_id,
        reviewer_id=current_user.id,
        pr_title=req.pr_title,
        pr_number=req.pr_number,
        branch=req.branch,
        files_changed=req.files_changed,
        code_snippet=req.code_snippet,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    # 失效缓存
    await cache_delete(f"{CACHE_REVIEWS}:all", f"{CACHE_REVIEWS}:{req.project_id}", CACHE_STATS)
    return review


@router.get("/", response_model=list[ReviewResponse])
async def list_reviews(
    project_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取审查列表（可按项目筛选）"""
    # 缓存键按 project_id 区分
    cache_key = f"{CACHE_REVIEWS}:{project_id or 'all'}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return JSONResponse(content=cached, headers={"X-Cache": "HIT"})

    query = select(Review).order_by(Review.updated_at.desc())
    if project_id:
        query = query.where(Review.project_id == project_id)
    result = await db.execute(query)
    reviews = result.scalars().all()
    data = [ReviewResponse.model_validate(r).model_dump(mode="json") for r in reviews]
    await cache_set(cache_key, data)
    return JSONResponse(content=data, headers={"X-Cache": "MISS"})


@router.get("/{review_id}", response_model=ReviewResponse)
async def get_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取单条审查详情"""
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="审查记录不存在")
    return review


@router.put("/{review_id}", response_model=ReviewResponse)
async def update_review(
    review_id: int,
    req: ReviewUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新审查记录（ai_result / ai_score / status）"""
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="审查记录不存在")

    # 仅更新传入的非 None 字段
    if req.ai_result is not None:
        review.ai_result = req.ai_result
    if req.ai_score is not None:
        review.ai_score = req.ai_score
    if req.status is not None:
        try:
            review.status = ReviewStatus(req.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效状态: {req.status}")

    await db.commit()
    await db.refresh(review)

    # 失效缓存
    p_id = review.project_id
    await cache_delete(f"{CACHE_REVIEWS}:all", f"{CACHE_REVIEWS}:{p_id}", CACHE_STATS)
    return review


@router.post("/{review_id}/analyze")
async def analyze_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(require_reviewer),  # RBAC: 仅审查者和管理员可触发 AI 分析
    db: AsyncSession = Depends(get_db),
):
    """
    AI 流式分析 — 对已有审查记录的代码进行 AI 审查
    通过 SSE 实时推送结果，分析完成后自动保存到数据库
    """
    # 1. 查询审查记录
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="审查记录不存在")
    if not review.code_snippet:
        raise HTTPException(status_code=400, detail="该审查记录未包含代码，请先编辑添加代码片段")

    # 2. 标记为"审查中"
    review.status = ReviewStatus.REVIEWING
    await db.commit()

    # 3. 获取项目语言（用于 AI prompt）
    proj_result = await db.execute(select(Project).where(Project.id == review.project_id))
    project = proj_result.scalar_one_or_none()
    language = project.language if project else "Python"

    async def event_stream():
        """SSE 事件流生成器：流式推送 AI 结果，完成后保存到数据库"""
        collected_chunks: list[str] = []
        try:
            # 流式调用 AI
            async for chunk in review_code_stream(review.code_snippet, language):
                collected_chunks.append(chunk)
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

            yield "data: [DONE]\n\n"

            # 4. AI 输出完成，保存到数据库
            full_result = "".join(collected_chunks)
            score = _extract_score(full_result)

            # 使用独立的数据库会话（避免与请求生命周期冲突）
            async with async_session() as save_db:
                save_result = await save_db.execute(
                    select(Review).where(Review.id == review_id)
                )
                r = save_result.scalar_one_or_none()
                if r:
                    r.ai_result = full_result
                    r.ai_score = score
                    r.status = ReviewStatus.COMPLETED
                    await save_db.commit()

                    # 失效缓存
                    await cache_delete(
                        f"{CACHE_REVIEWS}:all",
                        f"{CACHE_REVIEWS}:{r.project_id}",
                        CACHE_STATS,
                    )

        except Exception as e:
            # 发生异常时推送错误并回滚状态
            yield f"data: {json.dumps(f'[ERROR]{str(e)}', ensure_ascii=False)}\n\n"
            try:
                async with async_session() as fix_db:
                    fix_result = await fix_db.execute(
                        select(Review).where(Review.id == review_id)
                    )
                    r = fix_result.scalar_one_or_none()
                    if r:
                        r.status = ReviewStatus.PENDING
                        await fix_db.commit()
            except Exception:
                pass  # 回滚失败不影响流式输出

    return StreamingResponse(event_stream(), media_type="text/event-stream")
