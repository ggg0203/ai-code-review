# -*- coding: utf-8 -*-
"""
CI/CD 状态 API — 带缓存的 GitHub Actions 数据拉取
架构：后台定时刷新缓存 → 前端即时返回 → 3s 轮询无压力
"""
import asyncio
import json
import httpx
import threading
import time
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ci", tags=["CI/CD"])

GITHUB_API = "https://api.github.com"
REPO = "ggg0203/ai-code-review"

# ===== 全局缓存（线程安全） =====
_cache_lock = threading.Lock()
_cache_ready = False
_cache_data = {
    "success_rate": 0.0,
    "avg_duration": "N/A",
    "total_runs": 0,
    "builds": [],
}


# ===== Pydantic 模型 =====
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


# ===== 同步版本：从 GitHub API 拉取数据（在后台线程运行） =====
def _fetch_github_sync():
    """
    同步拉取 GitHub Actions 数据，返回构建列表。
    只请求 workflow runs 列表（1个 API 调用），不逐个拉 job 详情。
    耗时通常 < 500ms，不会触发前端超时。
    """
    token = settings.GITHUB_TOKEN
    if not token:
        return [], 0.0, "N/A"

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }

    try:
        resp = httpx.get(
            f"{GITHUB_API}/repos/{REPO}/actions/runs?per_page=5",
            headers=headers,
            timeout=10,
        )
        if resp.status_code != 200:
            return [], 0.0, "N/A"
        runs = resp.json().get("workflow_runs", [])
    except Exception:
        return [], 0.0, "N/A"

    builds = []
    durations = []
    success_count = 0

    for run in runs:
        rid = run["id"]
        conclusion = run.get("conclusion")
        status = run.get("status")
        run_number = run.get("run_number", "?")
        name = run.get("display_title", run.get("name", "?"))
        branch = run.get("head_branch", "main")
        commit_sha = (run.get("head_sha") or "")[:7]

        # 格式化时间
        created = run.get("created_at", "")
        if created:
            t = created.replace("T", " ").replace("Z", "")
            t = t[5:16] if len(t) > 16 else t
        else:
            t = ""

        # 计算耗时
        started = run.get("run_started_at", "")
        updated = run.get("updated_at", "")
        duration_str = "进行中..."
        if started and updated and conclusion:
            try:
                from datetime import datetime
                start_dt = datetime.fromisoformat(started.replace("Z", ""))
                end_dt = datetime.fromisoformat(updated.replace("Z", ""))
                seconds = int((end_dt - start_dt).total_seconds())
                duration_str = f"{seconds}s" if seconds < 60 else f"{seconds // 60}m{seconds % 60}s"
                durations.append(seconds)
            except Exception:
                pass

        # 状态映射
        if conclusion == "success":
            build_status = "success"
            success_count += 1
        elif conclusion == "failure":
            build_status = "failure"
        elif status == "in_progress":
            build_status = "running"
        else:
            build_status = "pending"

        # 从 workflow name 推断 stages（不再逐个请求 job 详情，太快）
        # 标准 CI workflow: backend + web + screen + deploy
        stages = []
        default_jobs = ["backend", "web", "screen"]
        for job_name in default_jobs:
            # 用 run 状态模拟各 job 状态
            if conclusion == "success":
                js = "success"
            elif conclusion == "failure":
                js = "failure"
            elif status == "in_progress":
                js = "running"
            else:
                js = "pending"
            stages.append({"name": job_name, "status": js, "duration": "-"})

        builds.append({
            "id": rid,
            "name": f"#{run_number} {name[:30]}",
            "status": build_status,
            "branch": branch,
            "duration": duration_str,
            "commit": commit_sha,
            "time": t,
            "stages": stages,
        })

    total = len(runs)
    rate = round(success_count / total * 100, 1) if total > 0 else 0.0
    avg_dur = "N/A"
    if durations:
        avg_s = sum(durations) // len(durations)
        avg_dur = f"{avg_s}s" if avg_s < 60 else f"{avg_s // 60}m{avg_s % 60}s"

    return builds, rate, avg_dur


# ===== 后台刷新线程 =====
def _refresh_cache():
    global _cache_data, _cache_ready
    while True:
        try:
            builds, rate, avg = _fetch_github_sync()
            with _cache_lock:
                _cache_data = {
                    "success_rate": rate,
                    "avg_duration": avg,
                    "total_runs": len(builds),
                    "builds": builds,
                }
                _cache_ready = True
        except Exception:
            pass
        time.sleep(60)  # 每 60 秒刷新一次


# 启动后台刷新线程
_refresh_thread = threading.Thread(target=_refresh_cache, daemon=True, name="ci-cache-refresh")
_refresh_thread.start()


# ===== API 端点 =====
@router.get("/status", response_model=CIStatusResponse)
async def get_ci_status(current_user: User = Depends(get_current_user)):
    """返回缓存的 CI/CD 数据，响应时间 < 1ms"""
    with _cache_lock:
        data = dict(_cache_data)  # 拷贝避免并发修改
    return CIStatusResponse(**data)
