# -*- coding: utf-8 -*-
"""
Redis 缓存工具 — 热点数据缓存 + 自动失效
Redis 不可用时自动降级，不影响业务
"""
import json
import logging
from typing import Any

import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger("cache")

# ===== 创建异步 Redis 客户端 =====
try:
    _redis: redis.Redis | None = redis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )
except Exception:
    logger.warning("Redis 连接失败，缓存功能已禁用")
    _redis = None


async def _get_redis() -> redis.Redis | None:
    """获取 Redis 客户端，不可用时返回 None"""
    if _redis is None:
        return None
    try:
        await _redis.ping()
        return _redis
    except Exception:
        return None


async def cache_get(key: str) -> Any | None:
    """从缓存读取，不可用时返回 None"""
    r = await _get_redis()
    if r is None:
        return None
    try:
        data = await r.get(key)
        if data is None:
            return None
        return json.loads(data)
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 60):
    """写入缓存，不可用时静默跳过"""
    r = await _get_redis()
    if r is None:
        return
    try:
        await r.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))
    except Exception:
        pass


async def cache_delete(*keys: str):
    """删除缓存，不可用时静默跳过"""
    if not keys:
        return
    r = await _get_redis()
    if r is None:
        return
    try:
        await r.delete(*keys)
    except Exception:
        pass


# ===== 缓存键前缀 =====
CACHE_PROJECTS = "cache:projects"
CACHE_REVIEWS = "cache:reviews"
CACHE_STATS = "cache:stats"
