# -*- coding: utf-8 -*-
"""
RAG API — 知识库管理 + 智能问答
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user, require_reviewer
from app.models.user import User
from app.ai.rag import add_to_knowledge, rag_query

router = APIRouter(prefix="/rag", tags=["RAG"])


class AddKnowledgeRequest(BaseModel):
    text: str
    project_name: str = ""


class RagQueryRequest(BaseModel):
    question: str
    top_k: int = 3


@router.post("/add")
async def add_knowledge(
    req: AddKnowledgeRequest,
    current_user: User = Depends(get_current_user),
    _: bool = Depends(require_reviewer),  # RBAC: 仅审查者和管理员可入库
):
    """添加代码到知识库"""
    try:
        await add_to_knowledge(req.text, {"project": req.project_name})
        return {"message": "已添加到知识库"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ask")
async def ask_rag(
    req: RagQueryRequest,
    current_user: User = Depends(get_current_user),
):
    """RAG 智能问答"""
    try:
        answer = await rag_query(req.question, req.top_k)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent")
async def ask_rag_agent(
    req: RagQueryRequest,
    current_user: User = Depends(get_current_user),
):
    """RAG ReAct Agent 智能问答（Thought → Action → Observation → Answer）"""
    try:
        from app.ai.rag import rag_query_agent
        answer = await rag_query_agent(req.question, req.top_k)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
