# -*- coding: utf-8 -*-
"""
CI/CD 状态 API — GitHub Actions 真实数据 + 内存缓存
策略：后台线程立即拉取 runs 列表（~5s），后续刷新再补 Job 详情
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
CST = timezone(timedelta(hours=8))

# ===== 缓存 =====
_cache_lock = threading.Lock()
_cache_data = {"success_rate": 0.0, "avg_duration": "N/A", "total_runs": 0, "builds": []}
_cache_ready = False


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


# ===== 工具 =====
def _gh_headers():
    return {
        "Authorization": f"token {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }


def _cst_time(utc_str: str) -> str:
    try:
        clean = utc_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean).astimezone(CST).strftime("%m-%d %H:%M")
    except Exception:
        return ""


def _duration(started: str, updated: str) -> str:
    try:
        s = datetime.fromisoformat(started.replace("Z", "+00:00"))
        e = datetime.fromisoformat(updated.replace("Z", "+00:00"))
        sec = int((e - s).total_seconds())
        if sec < 0:
            return "进行中..."
        return f"{sec}s" if sec < 60 else f"{sec // 60}m{sec % 60}s"
    except Exception:
        return "-"


def _build_status(conclusion, status):
    if conclusion == "success":
        return "success"
    if conclusion == "failure":
        return "failure"
    if status == "in_progress":
        return "running"
    return "pending"


def _parse_sec(dur_str: str) -> int | None:
    try:
        if "m" in dur_str:
            m, s = dur_str.replace("s", "").split("m")
            return int(m) * 60 + int(s)
        return int(dur_str.replace("s", ""))
    except Exception:
        return None


# ===== 快取：只拉 runs 列表（1 次 API 调用，~5s） =====
def _fetch_runs():
    """只获取 workflow runs 列表，不拉 job 详情，响应快"""
    if not settings.GITHUB_TOKEN:
        return []

    try:
        resp = httpx.get(
            f"{GITHUB_API}/repos/{REPO}/actions/runs?per_page=20",
            headers=_gh_headers(),
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        runs = resp.json().get("workflow_runs", [])
    except Exception:
        return []

    builds = []
    for run in runs:
        rid = run["id"]
        conclusion = run.get("conclusion")
        status = run.get("status")
        dur_str = _duration(run.get("run_started_at", ""), run.get("updated_at", ""))
        bs = _build_status(conclusion, status)

        builds.append({
            "id": rid,
            "name": f"#{run.get('run_number', '?')} {(run.get('display_title') or run.get('name', ''))[:35]}",
            "status": bs,
            "branch": run.get("head_branch", "main"),
            "duration": dur_str,
            "commit": (run.get("head_sha") or "")[:7],
            "time": _cst_time(run.get("created_at", "")),
            "stages": [{"name": "Pipeline", "status": bs, "duration": dur_str}],  # 简化为单阶段
        })

    return builds


# ===== 慢补：为指定构建拉真实 job 详情 =====
def _fetch_jobs(run_id: int) -> list[dict]:
    try:
        resp = httpx.get(
            f"{GITHUB_API}/repos/{REPO}/actions/runs/{run_id}/jobs?per_page=20",
            headers=_gh_headers(),
            timeout=8,
        )
        if resp.status_code != 200:
            return []
        jobs = []
        for j in resp.json().get("jobs", []):
            jobs.append({
                "name": j.get("name", "?"),
                "status": _build_status(j.get("conclusion"), j.get("status", "")),
                "duration": _duration(j.get("started_at", ""), j.get("completed_at", "")),
            })
        return jobs
    except Exception:
        return []


# ===== 完整刷新（runs + job 详情）=====
def _full_refresh():
    builds = _fetch_runs()
    if not builds:
        return

    # 为前 5 条补 Job 详情
    for i, b in enumerate(builds):
        if i >= 5:
            break
        jobs = _fetch_jobs(b["id"])
        if jobs:
            b["stages"] = jobs

    # 统计
    success_count = sum(1 for b in builds if b["status"] == "success")
    durations_sec = [s for b in builds if (s := _parse_sec(b["duration"]))]

    with _cache_lock:
        _cache_data = {
            "success_rate": round(success_count / max(len(builds), 1) * 100, 1),
            "avg_duration": f"{sum(durations_sec) // len(durations_sec)}s" if durations_sec else "N/A",
            "total_runs": len(builds),
            "builds": builds,
        }
        _cache_ready = True


# ===== 后台线程：立即快取 → 60s 后慢补 → 循环 =====
def _bg_worker():
    global _cache_ready

    # 第 0 轮：快取（~5s 填充）
    try:
        fast_builds = _fetch_runs()
        if fast_builds:
            sc = sum(1 for b in fast_builds if b["status"] == "success")
            with _cache_lock:
                _cache_data = {
                    "success_rate": round(sc / max(len(fast_builds), 1) * 100, 1),
                    "avg_duration": "N/A",
                    "total_runs": len(fast_builds),
                    "builds": fast_builds,
                }
                _cache_ready = True
    except Exception:
        pass

    # 后续循环：完整刷新
    while True:
        time.sleep(60)
        try:
            _full_refresh()
        except Exception:
            pass


_bg_thread = threading.Thread(target=_bg_worker, daemon=True, name="ci-bg")
_bg_thread.start()


# ===== API =====
@router.get("/status", response_model=CIStatusResponse)
async def get_ci_status(current_user: User = Depends(get_current_user)):
    with _cache_lock:
        data = dict(_cache_data)
    return CIStatusResponse(**data)
