# -*- coding: utf-8 -*-
"""
项目 API - 项目 CRUD
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.cache import cache_get, cache_set, cache_delete, CACHE_PROJECTS, CACHE_STATS
from app.core.security import get_current_user
from app.models.user import User
from app.models.project import Project, ProjectStatus
from datetime import datetime

router = APIRouter(prefix="/projects", tags=["项目"])


# ========== 请求/响应模型 ==========

class ProjectCreate(BaseModel):
    """创建项目请求"""
    name: str
    description: str | None = None
    repo_url: str | None = None
    language: str | None = None


class ProjectUpdate(BaseModel):
    """更新项目请求（全部可选，只更新传入的字段）"""
    name: str | None = None
    description: str | None = None
    repo_url: str | None = None
    language: str | None = None


class ProjectResponse(BaseModel):
    """项目响应"""
    id: int
    name: str
    description: str | None = None
    repo_url: str | None = None
    language: str | None = None
    status: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ========== 1. 创建项目 ==========

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    req: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新项目（任何登录用户都可以创建）"""
    project = Project(
        name=req.name,
        description=req.description,
        repo_url=req.repo_url,
        language=req.language,
        owner_id=current_user.id,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # 失效缓存
    await cache_delete(f"{CACHE_PROJECTS}:{current_user.id}", CACHE_STATS)
    return project


# ========== 2. 获取项目列表 ==========

@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的所有项目"""
    # 先查缓存
    cache_key = f"{CACHE_PROJECTS}:{current_user.id}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return JSONResponse(
            content=cached,
            headers={"X-Cache": "HIT"},
        )

    result = await db.execute(
        select(Project)
        .where(Project.owner_id == current_user.id)
        .where(Project.status != ProjectStatus.DELETED)
        .order_by(Project.updated_at.desc())
    )
    projects = result.scalars().all()
    data = [ProjectResponse.model_validate(p).model_dump(mode="json") for p in projects]
    await cache_set(cache_key, data)
    return JSONResponse(
        content=data,
        headers={"X-Cache": "MISS"},
    )


# ========== 3. 获取单个项目 ==========

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目详情"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


# ========== 4. 更新项目 ==========

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    req: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """编辑项目（仅项目所有者可操作）"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的项目")

    # 仅更新传入的非 None 字段
    if req.name is not None:
        project.name = req.name
    if req.description is not None:
        project.description = req.description
    if req.repo_url is not None:
        project.repo_url = req.repo_url
    if req.language is not None:
        project.language = req.language

    await db.commit()
    await db.refresh(project)

    await cache_delete(f"{CACHE_PROJECTS}:{current_user.id}", CACHE_STATS)
    return project


# ========== 5. 删除项目（软删除） ==========

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除项目（软删除，只改状态不删数据）"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的项目")

    project.status = ProjectStatus.DELETED
    await db.commit()

    await cache_delete(f"{CACHE_PROJECTS}:{current_user.id}", CACHE_STATS)
    return None  # 204 No Content
