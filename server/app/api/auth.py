# -*- coding: utf-8 -*-
"""
认证 API - 用户注册、登录、Token 刷新、GitHub OAuth 单点登录
"""
import httpx
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.config import settings
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
    _: bool = Depends(require_admin),
):
    """只有管理员能访问"""
    return {"message": f"你好管理员 {current_user.username}"}


# ========== 9. GitHub OAuth 单点登录 ==========

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_API = "https://api.github.com/user"


@router.get("/github/login")
async def github_login(source: str = "web"):
    """
    跳转 GitHub OAuth 授权页
    source=web   → 授权后重定向回 Web 端
    source=mobile → 授权后重定向回移动端
    """
    state = secrets.token_urlsafe(32)  # 防 CSRF
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": "http://localhost:8000/auth/github/callback",
        "scope": "user:email",
        "state": f"{source}:{state}",
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{GITHUB_AUTH_URL}?{qs}")


@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """
    GitHub OAuth 回调
    1. 用 code 换 access_token
    2. 拿 access_token 获取 GitHub 用户信息
    3. 查找或创建本地用户
    4. 签发 JWT
    5. 重定向回前端（带上 token）
    """
    # 解析 source
    source = "web"
    if ":" in state:
        source = state.split(":")[0]

    # 用 code 换 access_token
    token_resp = httpx.post(
        GITHUB_TOKEN_URL,
        data={
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
        },
        headers={"Accept": "application/json"},
        timeout=10,
    )
    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="GitHub Token 交换失败")
    gh_token = token_resp.json().get("access_token")
    if not gh_token:
        raise HTTPException(status_code=400, detail="未获取到 GitHub Token")

    # 用 access_token 获取 GitHub 用户信息
    user_resp = httpx.get(
        GITHUB_USER_API,
        headers={"Authorization": f"Bearer {gh_token}"},
        timeout=10,
    )
    if user_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="GitHub 用户信息获取失败")
    gh_user = user_resp.json()
    gh_id = gh_user["id"]
    gh_login = gh_user["login"]
    gh_email = gh_user.get("email") or f"{gh_login}@github.user"
    gh_avatar = gh_user.get("avatar_url", "")

    # 查找或创建用户
    # 先按 github_id 查
    result = await db.execute(select(User).where(User.github_id == gh_id))
    user = result.scalar_one_or_none()

    if not user:
        # 再按邮箱查（已有邮箱注册的账号）
        result = await db.execute(select(User).where(User.email == gh_email))
        user = result.scalar_one_or_none()

    if user:
        # 已有用户：绑定 github_id（如果还没绑定）
        if user.github_id is None:
            user.github_id = gh_id
        if not user.avatar_url and gh_avatar:
            user.avatar_url = gh_avatar
    else:
        # 新建用户
        user = User(
            username=gh_login,
            email=gh_email,
            hashed_password=hash_password(secrets.token_urlsafe(16)),  # 随机密码
            avatar_url=gh_avatar,
            github_id=gh_id,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    # 签发 JWT
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    # 重定向回前端（前端从 URL 参数取 token）
    if source == "mobile":
        redirect_url = f"http://localhost:5173/#/?access_token={access_token}&refresh_token={refresh_token}"
    else:
        redirect_url = f"http://localhost:5173/login?access_token={access_token}&refresh_token={refresh_token}"

    return RedirectResponse(redirect_url)
