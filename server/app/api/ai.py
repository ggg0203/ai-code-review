# -*- coding: utf-8 -*-
"""
AI API — 智能对话 + 代码审查
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from app.core.security import get_current_user
from app.models.user import User
from app.ai.reviewer import review_code, chat_with_ai, review_code_stream

router = APIRouter(prefix="/ai", tags=["AI"])


class CodeReviewRequest(BaseModel):
    code: str
    language: str = "Python"


class ChatRequest(BaseModel):
    message: str
    context: str = ""


@router.post("/review")
async def ai_review_code(
    req: CodeReviewRequest,
    current_user: User = Depends(get_current_user),
):
    """AI 代码审查"""
    try:
        result = await review_code(req.code, req.language)
        return {"review": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 审查失败: {str(e)}")


@router.post("/chat")
async def ai_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """AI 对话助手"""
    try:
        result = await chat_with_ai(req.message, req.context)
        return {"answer": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 对话失败: {str(e)}")


@router.post("/review/stream")
async def ai_review_stream(
    req: CodeReviewRequest,
    current_user: User = Depends(get_current_user),
):
    """AI 代码审查 — 流式输出（SSE）"""
    async def event_stream():
        try:
            async for chunk in review_code_stream(req.code, req.language):
                # JSON 编码避免换行符破坏 SSE 格式
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ========== 3. 多角色 Agent 协作审查（流式） ==========

class AgentReviewRequest(BaseModel):
    code: str
    language: str = "Python"


@router.post("/review/agent")
async def agent_review(
    req: AgentReviewRequest,
    current_user=Depends(get_current_user),
):
    """三个 Agent（安全/性能/风格）并行审查，流式推结果"""
    from app.ai.agent_reviewer import review_agent_stream

    async def event_stream():
        try:
            async for chunk in review_agent_stream(req.code, req.language):
                yield chunk
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
