# -*- coding: utf-8 -*-
"""
CI/CD 状态 API — GitHub Webhook 接收 + SSE 实时推送
架构：GitHub push → /ci/webhook → 事件总线 → SSE 前端实时更新
"""
import asyncio
import hmac
import hashlib
import json
import httpx
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings
from app.core.security import get_current_user, get_current_user_from_token
from app.models.user import User

router = APIRouter(prefix="/ci", tags=["CI/CD"])
GITHUB_API = "https://api.github.com"
REPO = "ggg0203/ai-code-review"

# ===== 事件总线：把 webhook 事件广播给所有 SSE 订阅者 =====
# 用一个 set 保存所有活跃的 asyncio.Queue，广播时遍历 push
subscribers: set[asyncio.Queue] = set()


async def broadcast(event: dict):
    """向所有 SSE 订阅者广播事件"""
    dead: set[asyncio.Queue] = set()
    data = json.dumps(event, ensure_ascii=False)
    for q in subscribers:
        try:
            q.put_nowait(data)
        except asyncio.QueueFull:
            dead.add(q)
    subscribers.difference_update(dead)


async def sse_subscriber():
    """生成一个 SSE 订阅者（asyncio.Queue），退出时自动清理"""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    subscribers.add(q)
    try:
        yield q
    finally:
        subscribers.discard(q)


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


# ===== 从 GitHub API 拉取构建数据的公共函数 =====
async def fetch_builds() -> tuple[list[dict], float, str]:
    """从 GitHub API 拉取最近 5 次构建"""
    token = settings.GITHUB_TOKEN
    if not token:
        return [], 0, "N/A"

    headers = {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{GITHUB_API}/repos/{REPO}/actions/runs?per_page=5", headers=headers)
            if resp.status_code != 200:
                return [], 0, "N/A"
            runs = resp.json().get("workflow_runs", [])
    except Exception:
        return [], 0, "N/A"

    builds = []
    durations = []
    success_count = 0
    total = len(runs)

    for run in runs:
        rid = run["id"]
        conclusion = run.get("conclusion")
        created = run.get("created_at", "")
        commit_sha = (run.get("head_sha") or "")[:7]
        branch = run.get("head_branch", "main")
        name = run.get("display_title", run.get("name", f"#{run['run_number']}"))

        if created:
            t = created.replace("T", " ").replace("Z", "")
            t = t[5:16] if len(t) > 16 else t
        else:
            t = ""

        started = run.get("run_started_at", "")
        updated = run.get("updated_at", "")
        duration_str = "进行中..."
        if started and updated and conclusion:
            start_dt = datetime.fromisoformat(started.replace("Z", ""))
            end_dt = datetime.fromisoformat(updated.replace("Z", ""))
            seconds = int((end_dt - start_dt).total_seconds())
            duration_str = f"{seconds}s" if seconds < 60 else f"{seconds // 60}m{seconds % 60}s"
            durations.append(seconds)

        if conclusion == "success":
            status = "success"
            success_count += 1
        elif conclusion == "failure":
            status = "failure"
        elif conclusion is None:
            status = "running"
        else:
            status = "failure"

        stages = []
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                jobs_resp = await client.get(
                    f"{GITHUB_API}/repos/{REPO}/actions/runs/{rid}/jobs?per_page=10",
                    headers=headers,
                )
                if jobs_resp.status_code == 200:
                    for job in jobs_resp.json().get("jobs", []):
                        jc = job.get("conclusion")
                        js = job.get("status")
                        if jc == "success":
                            s = "success"
                        elif jc == "failure":
                            s = "failure"
                        elif js == "in_progress":
                            s = "running"
                        else:
                            s = "pending"

                        j_start = job.get("started_at", "")
                        j_end = job.get("completed_at", "")
                        j_dur = "-"
                        if j_start and j_end:
                            js_s = datetime.fromisoformat(j_start.replace("Z", ""))
                            je_s = datetime.fromisoformat(j_end.replace("Z", ""))
                            sec = int((je_s - js_s).total_seconds())
                            j_dur = f"{sec}s" if sec < 60 else f"{sec // 60}m{sec % 60}s"

                        stages.append({"name": job.get("name", "?"), "status": s, "duration": j_dur})
        except Exception:
            pass

        builds.append({
            "id": rid, "name": f"#{run.get('run_number', '?')} {name[:30]}",
            "status": status, "branch": branch, "duration": duration_str,
            "commit": commit_sha, "time": t, "stages": stages,
        })

    rate = round(success_count / total * 100, 1) if total > 0 else 0
    avg_dur = "N/A"
    if durations:
        avg_s = sum(durations) // len(durations)
        avg_dur = f"{avg_s}s" if avg_s < 60 else f"{avg_s // 60}m{avg_s % 60}s"

    return builds, rate, avg_dur


# ===== 1. 拉取最新状态 =====
@router.get("/status", response_model=CIStatusResponse)
async def get_ci_status(current_user: User = Depends(get_current_user)):
    builds, rate, avg = await fetch_builds()
    return CIStatusResponse(success_rate=rate, avg_duration=avg, total_runs=len(builds), builds=builds)


# ===== 2. SSE 实时流 =====
@router.get("/stream")
async def ci_stream(token: str = Query(...)):
    """SSE 端点：前端 EventSource 连接，token 从 query string 传入"""
    # 验证 token
    try:
        user = await get_current_user_from_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    async def event_stream():
        async for q in sse_subscriber():
            # 先发全量数据
            builds, rate, avg = await fetch_builds()
            yield f"data: {json.dumps({'type': 'full', 'builds': builds, 'success_rate': rate, 'avg_duration': avg, 'total_runs': len(builds)}, ensure_ascii=False)}\n\n"

            # 循环接收 webhook 推送的事件
            while True:
                try:
                    data = await asyncio.wait_for(q.get(), timeout=30)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"  # SSE 保活

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ===== 3. GitHub Webhook 接收 =====
@router.post("/webhook")
async def ci_webhook(request: Request):
    """接收 GitHub Webhook 推送，广播到所有 SSE 订阅者"""
    body = await request.body()
    event_type = request.headers.get("X-GitHub-Event", "")

    # 验签（可选，从 .env 读 GITHUB_WEBHOOK_SECRET）
    secret = getattr(settings, "GITHUB_WEBHOOK_SECRET", "")
    if secret:
        signature = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # 只处理 workflow_run 和 workflow_job 事件
    if event_type not in ("workflow_run", "workflow_job"):
        return {"ok": True, "skipped": event_type}

    payload = json.loads(body)

    # 提取关键事件信息
    action = payload.get("action", "")
    if event_type == "workflow_run":
        wf = payload.get("workflow_run", {})
        run_id = wf.get("id")
        conclusion = wf.get("conclusion")
        status = wf.get("status")  # queued / in_progress / completed
        run_number = wf.get("run_number", "?")
        name = wf.get("display_title", wf.get("name", ""))
        head_branch = wf.get("head_branch", "main")
        head_sha = (wf.get("head_sha") or "")[:7]

        event = {
            "type": "workflow_run",
            "action": action,
            "run_id": run_id,
            "run_number": run_number,
            "name": name,
            "status": status,
            "conclusion": conclusion,
            "branch": head_branch,
            "commit": head_sha,
            "time": datetime.now(timezone.utc).strftime("%H:%M"),
        }
    elif event_type == "workflow_job":
        wf = payload.get("workflow_job", {})
        run_id = wf.get("run_id")
        job_name = wf.get("name", "?")
        job_conclusion = wf.get("conclusion")
        job_status = wf.get("status")  # queued / in_progress / completed

        event = {
            "type": "workflow_job",
            "action": action,
            "run_id": run_id,
            "job_name": job_name,
            "status": job_status,
            "conclusion": job_conclusion,
            "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        }

    await broadcast(event)
    return {"ok": True, "event": event}
