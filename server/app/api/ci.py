# -*- coding: utf-8 -*-
"""
CI/CD 状态 API — 对接 GitHub Actions，返回真实构建数据
"""
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ci", tags=["CI/CD"])

GITHUB_API = "https://api.github.com"
REPO = "ggg0203/ai-code-review"


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

    class Config:
        json_schema_extra = {
            "example": {
                "success_rate": 92.3,
                "avg_duration": "1m42s",
                "total_runs": 5,
                "builds": [],
            }
        }


@router.get("/status", response_model=CIStatusResponse)
async def get_ci_status(
    current_user: User = Depends(get_current_user),
):
    """获取 GitHub Actions 最近构建状态"""
    token = settings.GITHUB_TOKEN
    if not token:
        return CIStatusResponse(success_rate=0, avg_duration="N/A", total_runs=0, builds=[])

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
        # 1. 获取最近 5 次 workflow runs
        runs_resp = await client.get(
            f"{GITHUB_API}/repos/{REPO}/actions/runs?per_page=5",
            headers=headers,
        )
        if runs_resp.status_code != 200:
            return CIStatusResponse(success_rate=0, avg_duration="N/A", total_runs=0, builds=[])

        runs_data = runs_resp.json()
        workflow_runs = runs_data.get("workflow_runs", [])

        builds = []
        durations = []
        success_count = 0
        total = len(workflow_runs)

        for run in workflow_runs:
            rid = run["id"]
            conclusion = run.get("conclusion")  # success / failure / None (表示 running)
            created = run.get("created_at", "")
            commit_sha = (run.get("head_sha") or "")[:7]
            branch = run.get("head_branch", "main")
            name = run.get("display_title", run.get("name", f"#{run['run_number']}"))

            # 构建时间
            if created:
                t = created.replace("T", " ").replace("Z", "")
                if len(t) > 16:
                    t = t[5:16]  # MM-DD HH:mm
            else:
                t = ""

            # 计算耗时
            started = run.get("run_started_at", "")
            updated = run.get("updated_at", "")
            duration_str = "进行中..."
            if started and updated and conclusion:
                from datetime import datetime
                start_dt = datetime.fromisoformat(started.replace("Z", ""))
                end_dt = datetime.fromisoformat(updated.replace("Z", ""))
                seconds = int((end_dt - start_dt).total_seconds())
                if seconds < 60:
                    duration_str = f"{seconds}s"
                else:
                    duration_str = f"{seconds // 60}m{seconds % 60}s"
                durations.append(seconds)

            # 状态映射
            if conclusion == "success":
                status = "success"
                success_count += 1
            elif conclusion == "failure":
                status = "failure"
            elif conclusion is None:
                status = "running"
            else:
                status = "failure"

            # 2. 获取每个 run 的 job 详情
            stages: list[Stage] = []
            try:
                jobs_resp = await client.get(
                    f"{GITHUB_API}/repos/{REPO}/actions/runs/{rid}/jobs?per_page=10",
                    headers=headers,
                )
                if jobs_resp.status_code == 200:
                    jobs = jobs_resp.json().get("jobs", [])
                    for job in jobs:
                        j_conclusion = job.get("conclusion")
                        j_status = job.get("status")
                        # 确定 job 状态
                        if j_conclusion == "success":
                            s = "success"
                        elif j_conclusion == "failure":
                            s = "failure"
                        elif j_status == "in_progress":
                            s = "running"
                        else:
                            s = "pending"

                        # job 耗时
                        j_start = job.get("started_at", "")
                        j_end = job.get("completed_at", "")
                        j_dur = "-"
                        if j_start and j_end:
                            j_start_dt = datetime.fromisoformat(j_start.replace("Z", ""))
                            j_end_dt = datetime.fromisoformat(j_end.replace("Z", ""))
                            js = int((j_end_dt - j_start_dt).total_seconds())
                            j_dur = f"{js}s" if js < 60 else f"{js // 60}m{js % 60}s"

                        stages.append(Stage(
                            name=job.get("name", "unknown"),
                            status=s,
                            duration=j_dur,
                        ))
            except Exception:
                pass  # jobs 获取失败不影响主流程

            builds.append(BuildItem(
                id=rid,
                name=f"#{run.get('run_number', '?')} {name[:30]}",
                status=status,
                branch=branch,
                duration=duration_str,
                commit=commit_sha,
                time=t,
                stages=stages,
            ))

    # 计算统计
    rate = round(success_count / total * 100, 1) if total > 0 else 0
    avg_dur = "N/A"
    if durations:
        avg_s = sum(durations) // len(durations)
        avg_dur = f"{avg_s}s" if avg_s < 60 else f"{avg_s // 60}m{avg_s % 60}s"

    return CIStatusResponse(
        success_rate=rate,
        avg_duration=avg_dur,
        total_runs=total,
        builds=builds,
    )
    except Exception:
        return CIStatusResponse(success_rate=0, avg_duration="N/A", total_runs=0, builds=[])
