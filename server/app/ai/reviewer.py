# -*- coding: utf-8 -*-
"""
AI 代码审查服务 — 接入阿里云百炼（兼容 OpenAI 协议）
支持普通代码 + Vue/React 单文件组件分层审查
"""
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.core.config import settings
from app.ai.sfc_parser import (
    detect_sfc_type, build_sfc_prompt, build_sfc_prompt_stream, REGULAR,
)

# ===== 初始化百炼客户端 =====
client = AsyncOpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)


async def review_code(code: str, language: str = "Python") -> str:
    """AI 代码审查 — 支持 Vue/React 单文件组件"""
    sfc_type = detect_sfc_type(code, language)
    if sfc_type != REGULAR:
        prompt, display_lang = build_sfc_prompt(code, language)
        max_tok = 3072
    else:
        prompt = f"""你是一位资深代码审查专家，请审查以下 {language} 代码。

审查要点：
1. Bug 风险 — 逻辑错误、空指针
2. 性能问题 — 低效算法、内存浪费
3. 安全隐患 — SQL注入、XSS
4. 代码规范 — 命名、注释
5. 最佳实践 — 设计模式

输出格式：
## 🔍 审查总结
（一句话概述）
## 🐛 问题列表
1. [严重程度] 问题描述
## 📊 综合评分：X/100

待审查代码：
```{language}
{code}
```"""
        max_tok = 2048

    response = await client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=max_tok,
    )
    return response.choices[0].message.content or ""


async def chat_with_ai(message: str, context: str = "") -> str:
    """AI 对话助手"""
    system_prompt = "你是 AI Code Review Platform 的智能助手。"
    if context:
        system_prompt += f"\n相关代码上下文：\n{context}"

    response = await client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        temperature=0.7,
        max_tokens=2048,
    )
    return response.choices[0].message.content or ""


async def review_code_stream(code: str, language: str = "Python") -> AsyncGenerator[str, None]:
    """AI 代码审查 — 流式输出（SSE），支持 Vue/React 单文件组件"""
    sfc_type = detect_sfc_type(code, language)
    if sfc_type != REGULAR:
        prompt, _ = build_sfc_prompt_stream(code, language)
        max_tok = 3072
    else:
        prompt = f'''你是一位资深代码审查专家，请审查以下 {language} 代码。请严格遵循以下 Markdown 格式输出，确保内容结构清晰、突出关键信息。

审查维度：Bug 风险 | 性能问题 | 安全隐患 | 代码规范 | 最佳实践

---

**输出格式要求（严格遵守）：**

## 🔍 代码概览
（用 2-3 句话概述这段代码的功能和整体结构）

## 🔴 严重问题
> 使用 `[高]` 标签标记严重程度。每项包含：问题位置（行号/函数名）、原因、修复建议。
>
> 示例格式：
> - **[高] SQL 注入风险** — 第 15 行使用字符串拼接构造查询
>   - 原因：用户输入未经过滤直接拼入 SQL
>   - 建议：改用参数化查询，避免直接拼接

## 🟡 一般问题
> 使用 `[中]` 或 `[低]` 标签。涵盖性能、规范等问题。

## 💡 优化建议
> 提供具体的代码改进方案，必要时给出修改前后对比代码块。

## 📊 综合评分
>
> | 维度 | 评分 | 说明 |
> |------|------|------|
> | **安全性** | X/10 | 简要说明 |
> | **性能** | X/10 | 简要说明 |
> | **可读性** | X/10 | 简要说明 |
> | **可维护性** | X/10 | 简要说明 |
> | **综合** | **X/10** | 总结一句话 |

---
待审查代码：
```{language}
{code}
```'''
        max_tok = 2048

    stream = await client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=max_tok,
        stream=True,
    )

    async for chunk in stream:
        content = chunk.choices[0].delta.content
        if content:
            yield content
