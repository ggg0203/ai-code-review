# -*- coding: utf-8 -*-
"""
认证 API - 用户注册、登录、Token 刷新
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.core.security import get_current_user  
# ========== 1. 创建路由 ==========
router = APIRouter(prefix="/auth", tags=["认证"])
# prefix="/auth": 所有路由以 /auth 开头
# tags=["认证"]: Swagger 文档中归入"认证"分组


# ========== 2. 请求/响应模型 ==========

class RegisterRequest(BaseModel):
    """注册请求体"""
    username: str
    email: EmailStr
    # EmailStr: pydantic 自动校验邮箱格式
    password: str


class LoginRequest(BaseModel):
    """登录请求体"""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Token 响应体"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Token 刷新请求体"""
    refresh_token: str


class AccessTokenResponse(BaseModel):
    """仅返回 Access Token（刷新用）"""
    access_token: str
    token_type: str = "bearer"


# ========== 3. 注册接口 ==========

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    用户注册
    1. 检查用户名/邮箱是否已存在
    2. 创建用户并加密密码
    3. 返回 Token
    """
    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == req.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邮箱已注册")

    # 创建用户
    user = User(
        username=req.username,
        email=req.email,
        hashed_password=hash_password(req.password),  # 加密密码
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)  # 刷新以获取自动生成的 id

    # 生成 Token
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ========== 4. 登录接口 ==========

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    用户登录
    1. 查找用户
    2. 验证密码
    3. 返回 Token
    """
    # 查找用户
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    # 验证密码
    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    # 检查账号是否禁用
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")

    # 生成 Token
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


# ========== 5. Token 刷新接口 ==========

@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh_token(req: RefreshRequest):
    """
    使用 Refresh Token 换取新的 Access Token（短期）
    
    流程：
    1. 客户端在 access_token 过期后，用 refresh_token 请求此接口
    2. 后端验证 refresh_token 的有效性
    3. 通过后签发新的 access_token（不返回新的 refresh_token）
    
    安全要点：
    - 必须验证 token_type 为 "refresh"，防止用 access_token 来刷新
    - refresh_token 过期需重新登录
    """
    payload = decode_token(req.refresh_token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Refresh Token 无效或已过期")

    # 安全检查：必须是 refresh token（不能是 access token）
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的 Token 类型，请使用 Refresh Token")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Token 格式错误")

    # 签发新的 access_token
    new_access_token = create_access_token(data={"sub": email})
    return AccessTokenResponse(access_token=new_access_token)


# ========== 6. 获取当前用户信息（需要登录） ==========


from datetime import datetime  # 放在文件顶部 import 区


class UserResponse(BaseModel):
    """用户信息响应体"""
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime  # 自动序列化为 ISO 格式字符串

    class Config:
        from_attributes = True  # 允许从 ORM 对象自动转换


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    获取当前登录用户信息
    需要在请求头带上：Authorization: Bearer <access_token>
    """
    return current_user


# ========== 6.5 修改密码 ==========

class ChangePasswordRequest(BaseModel):
    """修改密码请求体"""
    old_password: str
    new_password: str


@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    修改当前用户密码
    - 验证旧密码
    - 更新为新密码的哈希
    """
    # 验证旧密码
    if not verify_password(req.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="旧密码错误")

    # 更新密码
    current_user.hashed_password = hash_password(req.new_password)
    await db.commit()

    return {"message": "密码修改成功"}


# ========== 7. 管理员用户管理 ==========
from app.core.security import require_admin
from app.models.user import UserRole


class AdminUserResponse(BaseModel):
    """管理员视角的用户信息（含完整字段）"""
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateRoleRequest(BaseModel):
    """修改角色请求"""
    role: str


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    _: bool = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """获取所有用户列表（仅管理员）"""
    result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.put("/users/{user_id}/role", response_model=AdminUserResponse)
async def update_user_role(
    user_id: int,
    req: UpdateRoleRequest,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """修改用户角色（仅管理员）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能修改自己的角色")

    try:
        user.role = UserRole(req.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效角色: {req.role}")

    await db.commit()
    await db.refresh(user)
    return user


@router.put("/users/{user_id}/toggle-active", response_model=AdminUserResponse)
async def toggle_user_active(
    user_id: int,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """启用/禁用用户（仅管理员）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能禁用自己的账号")

    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return user


# ========== 8. RBAC 测试接口 ==========

@router.get("/admin-only")
async def admin_only(
    current_user: User = Depends(get_current_user),
    _: bool = Depends(require_admin),  # require_admin 检查 → 非admin返回403
):
    """只有管理员能访问"""
    return {"message": f"你好管理员 {current_user.username}"}
