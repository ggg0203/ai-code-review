# -*- coding: utf-8 -*-
"""
CI/CD 状态 API — 模拟数据
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import random

from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ci", tags=["CI/CD"])


class Stage(BaseModel):
    name: str
    status: str
    duration: str


class BuildItem(BaseModel):
    id: int
    name: str
    status: str
    branch: str
    duration: str
    commit: str
    time: str
    stages: list[Stage]


class CIStatusResponse(BaseModel):
    success_rate: float
    avg_duration: str
    total_runs: int
    builds: list[BuildItem]


# 生成 20 条构建记录
def _generate_builds():
    build_names = [
        "refactor: 重写CI/CD监控，后端加缓存避免超时",
        "fix: CI后台线程加stderr日志，排查缓存不更新",
        "fix: 退出登录后自动跳转登录页",
        "fix: 添加 greenlet 依赖",
        "refactor: 移除SSH部署，改用ECS cron自动拉取",
        "ci: 回退密钥登录",
        "ci: 改为密码登录",
        "ci: 触发容器化部署",
        "feat: 多Agent并行代码审查",
        "feat: ReAct Agent RAG问答",
        "fix: 移动端SSE流式输出",
        "feat: CI/CD实时监控大屏",
        "feat: 前端流式审查页面",
        "feat: 知识库RAG问答",
        "feat: RBAC权限系统",
        "feat: 阿里云百炼AI集成",
        "fix: Monaco Editor高度溢出",
        "feat: 3D大屏Three.js可视化",
        "feat: 前后端分离架构搭建",
        "init: 项目初始化 Monorepo 架构",
    ]
    stages_templates = [
        [("backend", "success", "21s"), ("web", "success", "14s"), ("screen", "success", "10s"), ("deploy", "success", "3s")],
        [("backend", "success", "18s"), ("web", "success", "12s"), ("screen", "success", "9s"), ("deploy", "failure", "5s")],
        [("backend", "failure", "22s"), ("web", "success", "15s"), ("screen", "success", "11s"), ("deploy", "pending", "-")],
        [("backend", "success", "20s"), ("web", "running", "…"), ("screen", "pending", "-"), ("deploy", "pending", "-")],
    ]

    builds = []
    success_count = 0
    durations_sec = []

    for i in range(20):
        s = stages_templates[i % 4]
        is_success = all(st[1] == "success" for st in s)
        status = "success" if is_success else ("failure" if any(st[1] == "failure" for st in s) else "running")
        if status == "success":
            success_count += 1
        dur = sum(int(st[2].replace("s", "")) for st in s if st[2] != "-" and st[2] != "…")
        durations_sec.append(dur)

        builds.append({
            "id": 100 + i,
            "name": f"#{(42 - i) if i < 20 else '?'} {build_names[i]}",
            "status": status,
            "branch": "main",
            "duration": f"{dur // 60}m{dur % 60}s" if dur >= 60 else f"{dur}s",
            "commit": f"a{(random.randint(10, 99)):04b}{random.randint(100, 999)}"[0:7],
            "time": f"06-{(4 - i // 3 if i < 12 else 6 - i // 5):02d} {(8 + i % 14):02d}:{(i * 7 + 15) % 60:02d}",
            "stages": [{"name": st[0], "status": st[1], "duration": st[2]} for st in s],
        })

    rate = round(success_count / 20 * 100, 1)
    avg = sum(durations_sec) // len(durations_sec)
    avg_str = f"{avg // 60}m{avg % 60}s" if avg >= 60 else f"{avg}s"

    return builds, rate, avg_str


_cached = None


@router.get("/status", response_model=CIStatusResponse)
async def get_ci_status(current_user: User = Depends(get_current_user)):
    global _cached
    if _cached is None:
        builds, rate, avg = _generate_builds()
        _cached = {"success_rate": rate, "avg_duration": avg, "total_runs": len(builds), "builds": builds}
    return CIStatusResponse(**_cached)
