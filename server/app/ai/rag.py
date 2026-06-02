# -*- coding: utf-8 -*-
"""
RAG 知识库 — 向量化 + 语义搜索
"""
from openai import AsyncOpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

from app.core.config import settings

# ===== 百炼客户端（用于 embedding） =====
client = AsyncOpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# ===== Qdrant 客户端 =====
qdrant = QdrantClient(host="localhost", port=6333)

# 向量维度（text-embedding-v2 输出 1536 维）
VECTOR_DIM = 1536
COLLECTION_NAME = "code_reviews"


async def init_collection():
    """初始化 Qdrant 集合（不存在则创建）"""
    if not qdrant.collection_exists(COLLECTION_NAME):
        qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )


async def get_embedding(text: str) -> list[float]:
    """
    将文本转为向量
    使用通义千问 text-embedding-v2 模型
    """
    resp = await client.embeddings.create(
        model="text-embedding-v2",
        input=text,
    )
    return resp.data[0].embedding


async def add_to_knowledge(text: str, metadata: dict):
    """
    添加文本到知识库
    text: 要存储的文本
    metadata: 附加信息（项目名、文件路径等）
    """
    vector = await get_embedding(text)

    qdrant.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=abs(hash(text + str(metadata))) % (10**12),  # 唯一 ID
                vector=vector,
                payload={"text": text, **metadata},
            )
        ],
    )


async def search_knowledge(query: str, limit: int = 5) -> list[dict]:
    """语义搜索知识库"""
    vector = await get_embedding(query)
    results = qdrant.query_points(
        collection_name=COLLECTION_NAME,
        query=vector,
        limit=limit,
    )

    return [
        {
            "text": hit.payload["text"],
            "score": hit.score,
        }
        for hit in results.points
    ]


async def rag_query(question: str, top_k: int = 3) -> str:
    """
    RAG 完整流程：搜索 + 回答
    """
    # 1. 搜索相关上下文
    hits = await search_knowledge(question, limit=top_k)
    context = "\n\n".join([h["text"] for h in hits])

    # 2. 用上下文构��� prompt
    prompt = f"""基于以下代码审查知识回答问题。

上下文：
{context}

问题：{question}

要求：如果上下文中没有相关信息，请说明"知识库中暂无相关内容"。"""

    # 3. 调用 AI 生成回答
    resp = await client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        max_tokens=1024,
    )

    return resp.choices[0].message.content or ""
