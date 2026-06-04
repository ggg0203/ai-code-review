# -*- coding: utf-8 -*-
"""
多角色协作 Agent — 安全/性能/风格 三个 Agent 并行审查
支持 Vue/React 单文件组件分层审查
"""
import asyncio
import json
from typing import AsyncGenerator

from openai import AsyncOpenAI
from app.core.config import settings
from app.ai.sfc_parser import detect_sfc_type, split_vue_sfc, VUE_SFC, REACT_JSX, REACT_TSX, REGULAR

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

# ===== Vue SFC Agent 提示词（末尾追加前端专项提示）=====
SFC_APPEND = {
    "security": """

额外前端安全检查：
- Template 中的 v-html 是否可能导致 XSS
- 用户输入是否经过过滤
- 敏感数据是否暴露在客户端""",

    "performance": """

额外前端性能检查：
- 是否避免了 v-for 和 v-if 同时使用
- computed vs method 选择是否正确
- 大列表是否使用虚拟滚动
- 组件是否避免不必要的重渲染""",

    "style": """

额外前端规范检查：
- 组件命名是否符合 Vue/React 风格指南
- Props/Emits 是否有清晰的类型定义
- 是否遵循组件单一职责原则
- CSS 是否使用了 scoped 或 CSS Modules""",
}


async def review_agent_stream(code: str, language: str) -> AsyncGenerator[str, None]:
    """
    三个 Agent 并行审查同一份代码，流式输出
    支持 Vue/React 单文件组件：自动拆解为 template/script/style 三部分
    """
    sfc_type = detect_sfc_type(code, language)

    # 构建用户提示词
    if sfc_type == VUE_SFC:
        parts = split_vue_sfc(code)
        sections = []
        if parts["template"]:
            sections.append(f"### 📌 Template\n```html\n{parts['template']}\n```")
        if parts["script"]:
            lang = "typescript" if 'lang="ts"' in code else "javascript"
            sections.append(f"### 📝 Script\n```{lang}\n{parts['script']}\n```")
        if parts["style"]:
            sections.append(f"### 🎨 Style\n```css\n{parts['style']}\n```")
        user_prompt = "请审查以下 Vue 单文件组件，按 Template / Script / Style 三个区域分别审查：\n\n" + "\n\n".join(sections)
        uses_sfc = True
    elif sfc_type in (REACT_JSX, REACT_TSX):
        lang = "tsx" if sfc_type == REACT_TSX else "jsx"
        user_prompt = f"请审查以下 React 组件（{lang.upper()}）：\n\n```{lang}\n{code}\n```"
        uses_sfc = True
    else:
        user_prompt = f"请审查以下{language}代码：\n\n```{language.lower()}\n{code}\n```"
        uses_sfc = False

    async def call_agent(agent_type: str):
        """调用单个 Agent"""
        system_prompt = AGENT_PROMPTS[agent_type]
        if uses_sfc:
            system_prompt += SFC_APPEND[agent_type]

        try:
            response = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=2000 if uses_sfc else 1500,
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

    # 发送开始信号（包含 SFC 类型信息）
    yield f"data: {json.dumps({'type': 'start', 'agents': ['security', 'performance', 'style'], 'sfc_type': sfc_type}, ensure_ascii=False)}\n\n"

    # 逐个 Agent 推送结果
    for completed in asyncio.as_completed(tasks):
        agent_type, content, error = await completed
        if error:
            yield f"data: {json.dumps({'type': 'agent_error', 'agent': agent_type, 'error': error}, ensure_ascii=False)}\n\n"
        elif content:
            yield f"data: {json.dumps({'type': 'agent_result', 'agent': agent_type, 'content': content}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
