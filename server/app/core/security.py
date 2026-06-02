# -*- coding: utf-8 -*-
"""
安全工具 - 密码哈希、JWT Token 生成与验证
"""
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.core.config import settings
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.user import User
# ========== 1. 密码哈希 ==========
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# CryptContext: 密码加密工具
# schemes=["bcrypt"]: 使用 bcrypt 算法（安全性高）
# deprecated="auto": 自动标记过时的哈希算法


def hash_password(password: str) -> str:
    """
    明文密码 → 哈希密码
    数据库中只存哈希值，即使数据库泄露密码也不会暴露
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码是否正确
    plain_password: 用户输入的密码
    hashed_password: 数据库中存的哈希值
    返回 True（匹配）/ False（不匹配）
    """
    return pwd_context.verify(plain_password, hashed_password)


# ========== 2. JWT Token ==========

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    生成 Access Token（短期，用于访问 API）
    
    data: 要编码进 Token 的数据，如 {"sub": "user@example.com"}
    expires_delta: 过期时间，默认从配置读取
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # 默认过期时间：配置中的 ACCESS_TOKEN_EXPIRE_MINUTES
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})  # exp 是 JWT 标准字段，表示过期时间
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    生成 Refresh Token（长期，用于刷新 Access Token）
    过期时间固定为 7 天
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "type": "refresh"})  # type 区分 Token 类型
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def decode_token(token: str) -> dict | None:
    """
    解码并验证 Token
    成功返回 Token 中的数据，失败返回 None
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        # Token 过期、签名错误、被篡改等情况
        return None

# ========== 3. 从 Token 获取当前用户 ==========



# HTTPBearer: 从请求头 Authorization: Bearer xxx 中提取 Token
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    从请求中提取 Token → 解码 → 查找用户
    如果 Token 无效或用户不存在，返回 401
    """
    token = credentials.credentials  # 取出 Token 字符串
    payload = decode_token(token)    # 解码

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
        )

    email = payload.get("sub")  # sub 是我们在创建 Token 时放的邮箱
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 格式错误",
        )

    # 从数据库查找用户
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )

    return user

# ========== 4. RBAC 权限依赖 ==========
from typing import List

from app.models.user import UserRole


class RoleChecker:
    """
    权限检查器
    用法：
        @app.get("/admin-only")
        async def admin_endpoint(
            current_user: User = Depends(get_current_user),
            _: bool = Depends(RoleChecker([UserRole.ADMIN]))
        ):
            ...
    """

    def __init__(self, allowed_roles: List[UserRole]):
        """
        allowed_roles: 允许访问的角色列表
        如 [UserRole.ADMIN] 表示只有管理员能访问
        如 [UserRole.ADMIN, UserRole.REVIEWER] 表示管理员和审查者都能访问
        """
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> bool:
        """
        FastAPI 依赖注入调用此方法
        检查当前用户角色是否在允许列表中
        """
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"角色 {current_user.role.value} 无权限执行此操作",
            )
        return True


# ========== 5. 常用权限预设 ==========

# 仅管理员
require_admin = RoleChecker([UserRole.ADMIN])

# 仅审查者及以上（审查者 + 管理员）
require_reviewer = RoleChecker([UserRole.ADMIN, UserRole.REVIEWER])

# 所有登录用户均可（不限角色）
require_login = Depends(get_current_user)
