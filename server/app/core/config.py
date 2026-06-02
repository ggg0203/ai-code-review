# -*- coding: utf-8 -*-
"""
配置管理 - 从 .env 文件读取所有配置项
"""
from pydantic_settings import BaseSettings
# pydantic_settings: 自动读取 .env 文件，转成 Python 对象


class Settings(BaseSettings):
    """应用配置类"""

    # ========== 数据库 ==========
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ai_code_review"
    # 数据库连接字符串，优先级：.env 文件 > 默认值

    # ========== Redis ==========
    REDIS_URL: str = "redis://localhost:6379/0"
    # Redis 连接字符串

    # ========== JWT 认证 ==========
    SECRET_KEY: str = "change-me-in-production"
    # JWT 签名密钥，生产环境必须换成随机字符串

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Token 过期时间（分钟）

    # ========== AI 配置 ==========
    DASHSCOPE_API_KEY: str = ""
    # 阿里云百炼 API Key（接入 AI 功能时填写）

    # ========== GitHub 配置 ==========
    GITHUB_TOKEN: str = ""
    # GitHub Personal Access Token（用于 CI/CD 监控等）

    # ========== pydantic-settings 配置 ==========
    class Config:
        env_file = ".env"          # 指定 .env 文件路径
        env_file_encoding = "utf-8" # 文件编码
        extra = "allow"             # 允许额外字段（不报错）


# 创建全局配置单例（其他模块直接 import settings）
settings = Settings()
