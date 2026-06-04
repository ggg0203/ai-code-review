# -*- coding: utf-8 -*-
"""
CI/CD 状态 API — 真实 GitHub Actions 数据 + 内存缓存
架构：模块加载时立即拉取 → 后台 60s 定时刷新 → API 秒回
"""
import threading
import time
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ci", tags=["CI/CD"])

GITHUB_API = "https://api.github.com"
REPO = "ggg0203/ai-code-review"
CST = timezone(timedelta(hours=8))  # 北京时间 UTC+8

# ===== 全局缓存 =====
_cache_lock = threading.Lock()
_cache_data = {"success_rate": 0.0, "avg_duration": "N/A", "total_runs": 0, "builds": []}


# ===== 模型 =====
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


# ===== 工具函数 =====
def _github_headers():
    return {
        "Authorization": f"token {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }


def _to_cst(utc_str: str) -> str:
    """UTC 字符串 → 北京时间字符串 (MM-DD HH:MM)"""
    try:
        utc_str_clean = utc_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(utc_str_clean).astimezone(CST)
        return dt.strftime("%m-%d %H:%M")
    except Exception:
        return utc_str[:16] if utc_str else ""


def _calc_duration(started: str, updated: str) -> str:
    """计算两个 UTC 字符串之间的耗时"""
    try:
        start = datetime.fromisoformat(started.replace("Z", "+00:00"))
        end = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        sec = int((end - start).total_seconds())
        if sec < 0:
            return "进行中..."
        return f"{sec}s" if sec < 60 else f"{sec // 60}m{sec % 60}s"
    except Exception:
        return "-"


def _status_from_conclusion(conclusion: str | None, status: str) -> str:
    """GitHub conclusion/status → 前端状态"""
    if conclusion == "success":
        return "success"
    if conclusion == "failure":
        return "failure"
    if status == "in_progress":
        return "running"
    return "pending"


def _fetch_jobs_for_run(run_id: int) -> list[dict]:
    """拉取某次构建的真实 job 列表"""
    try:
        resp = httpx.get(
            f"{GITHUB_API}/repos/{REPO}/actions/runs/{run_id}/jobs?per_page=20",
            headers=_github_headers(),
            timeout=8,
        )
        if resp.status_code != 200:
            return []
        jobs = []
        for j in resp.json().get("jobs", []):
            j_dur = _calc_duration(
                j.get("started_at", ""),
                j.get("completed_at", ""),
            )
            jobs.append({
                "name": j.get("name", "?"),
                "status": _status_from_conclusion(j.get("conclusion"), j.get("status", "")),
                "duration": j_dur,
            })
        return jobs
    except Exception:
        return []


# ===== 核心：拉取真实数据 =====
def _fetch_github_sync():
    token = settings.GITHUB_TOKEN
    if not token:
        return [], 0.0, "N/A"

    # 第一步：拉取最近 20 条 workflow runs
    try:
        resp = httpx.get(
            f"{GITHUB_API}/repos/{REPO}/actions/runs?per_page=20",
            headers=_github_headers(),
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

    for idx, run in enumerate(runs):
        rid = run["id"]
        conclusion = run.get("conclusion")
        status = run.get("status")
        run_number = run.get("run_number", "?")
        display_name = run.get("display_title", run.get("name", "?"))
        branch = run.get("head_branch", "main")
        commit_sha = (run.get("head_sha") or "")[:7]

        # 北京时间
        created_cst = _to_cst(run.get("created_at", ""))

        # 耗时
        dur_str = _calc_duration(
            run.get("run_started_at", ""),
            run.get("updated_at", ""),
        )
        if dur_str != "进行中..." and dur_str != "-":
            # 提取秒数用于统计
            try:
                m = dur_str.replace("s", "").replace("m", ":")
                if ":" in m:
                    parts = m.split(":")
                    durations.append(int(parts[0]) * 60 + int(parts[1]))
                else:
                    durations.append(int(m))
            except Exception:
                pass

        # 构建状态
        build_status = _status_from_conclusion(conclusion, status)
        if build_status == "success":
            success_count += 1

        # 对最近 5 条获取详细 job 信息，其余只显示 run 级别状态
        if idx < 5:
            stages = _fetch_jobs_for_run(rid)
        else:
            # 没有详细 job 信息时，显示 run 级别的单一阶段
            stages = [{"name": "CI", "status": build_status, "duration": dur_str}]

        builds.append({
            "id": rid,
            "name": f"#{run_number} {display_name[:35]}",
            "status": build_status,
            "branch": branch,
            "duration": dur_str,
            "commit": commit_sha,
            "time": created_cst,
            "stages": stages,
        })

    total = len(runs)
    rate = round(success_count / total * 100, 1) if total > 0 else 0.0
    avg_dur = "N/A"
    if durations:
        avg_s = sum(durations) // len(durations)
        avg_dur = f"{avg_s}s" if avg_s < 60 else f"{avg_s // 60}m{avg_s % 60}s"

    return builds, rate, avg_dur


# ===== 后台定时刷新 =====
def _refresh_loop():
    global _cache_data
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
        except Exception:
            pass
        time.sleep(60)


# 模块加载时立即执行首次刷新
try:
    _initial_builds, _initial_rate, _initial_avg = _fetch_github_sync()
    _cache_data = {
        "success_rate": _initial_rate,
        "avg_duration": _initial_avg,
        "total_runs": len(_initial_builds),
        "builds": _initial_builds,
    }
except Exception:
    pass

_refresh_thread = threading.Thread(target=_refresh_loop, daemon=True, name="ci-refresh")
_refresh_thread.start()


# ===== API =====
@router.get("/status", response_model=CIStatusResponse)
async def get_ci_status(current_user: User = Depends(get_current_user)):
    with _cache_lock:
        data = dict(_cache_data)
    return CIStatusResponse(**data)
