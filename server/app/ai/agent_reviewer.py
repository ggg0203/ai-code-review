# -*- coding: utf-8 -*-
"""
多角色协作 Agent — 安全/性能/风格 三个 Agent 并行审查
"""
import asyncio
import json
from typing import AsyncGenerator

from openai import AsyncOpenAI
from app.core.config import settings

client = AsyncOpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)
MODEL = "deepseek-v4-pro"

# ===== 三个 Agent 的系统提示词 =====
AGENT_PROMPTS = {
    "security": """你是一个资深的代码安全审查专家（Security Agent）。
你的唯一职责是发现代码中的安全漏洞。

重点关注：
1. SQL注入、XSS、CSRF等常见Web漏洞
2. 硬编码的密钥、Token、密码
3. 路径遍历、文件上传漏洞
4. 认证与授权缺陷
5. 不安全的加密算法

输出要求（Markdown格式）：
## 🔴 安全Agent 审查结果

### 发现漏洞
对每个漏洞用以下格式：
> **[严重/高/中/低] 漏洞名称** — 位置
> 详细说明和攻击场景
> 修复建议

### 安全评分（/100）
给出安全评分和理由。""",

    "performance": """你是一个资深的性能优化专家（Performance Agent）。
你的唯一职责是发现代码中的性能问题。

重点关注：
1. N+1查询、循环中的数据库调用
2. 时间复杂度问题、不必要的循环嵌套
3. 内存泄漏风险（未释放的资源、无限增长的缓存）
4. 阻塞调用、同步操作中的异步机会
5. 大数据量下的算法效率

输出要求（Markdown格式）：
## 🟡 性能Agent 审查结果

### 性能问题
对每个问题用以下格式：
> **[高/中/低] 问题名称** — 位置
> 详细分析和量化影响
> 优化建议及预期收益

### 性能评分（/100）
给出性能评分和理由。""",

    "style": """你是一个资深的代码规范专家（Style Agent）。
你的唯一职责是审查代码的可读性和规范性。

重点关注：
1. 命名规范（变量、函数、类名是否符合语言惯例）
2. 代码结构和组织（函数长度、类职责单一性、模块划分）
3. 注释和文档质量
4. 错误处理是否完整
5. 代码重复、魔法数字等坏味道

输出要求（Markdown格式）：
## 🔵 代码规范Agent 审查结果

### 规范问题
对每个问题用以下格式：
> **[高/中/低] 问题名称** — 位置
> 详细说明和改进建议

### 规范评分（/100）
给出规范评分和理由。""",
}


async def review_agent_stream(code: str, language: str) -> AsyncGenerator[str, None]:
    """
    三个 Agent 并行审查同一份代码，流式输出
    策略：先发各 Agent 的 system prompt，再逐条推送内容
    """
    async def call_agent(agent_type: str):
        """调用单个 Agent"""
        system_prompt = AGENT_PROMPTS[agent_type]
        user_prompt = f"请审查以下{language}代码：\n\n```{language.lower()}\n{code}\n```"

        try:
            response = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=1500,
            )
            content = response.choices[0].message.content or ""
            return agent_type, content, None
        except Exception as e:
            return agent_type, None, str(e)

    # 并行呼叫三个 Agent
    tasks = [
        call_agent("security"),
        call_agent("performance"),
        call_agent("style"),
    ]

    # 发送开始信号
    yield f"data: {json.dumps({'type': 'start', 'agents': ['security', 'performance', 'style']}, ensure_ascii=False)}\n\n"

    # 逐个 Agent 推送结果
    for completed in asyncio.as_completed(tasks):
        agent_type, content, error = await completed
        if error:
            yield f"data: {json.dumps({'type': 'agent_error', 'agent': agent_type, 'error': error}, ensure_ascii=False)}\n\n"
        elif content:
            # 分块推送，前端渐进展示
            yield f"data: {json.dumps({'type': 'agent_result', 'agent': agent_type, 'content': content}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
